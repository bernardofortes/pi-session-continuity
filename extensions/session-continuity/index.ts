import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
	detectNativeAutoCompaction,
	loadConfig,
	publicConfigFromResolved,
	validateConfigDraftForPath,
	writeConfigToDisk,
	type ContinuityConfig,
	type ResolvedContinuityConfig,
	type SynthesisEffort,
} from "../../src/config.js";
import {
	AUTOMATIC_FAILURE_COOLDOWN_MS,
	PRODUCT_NAME,
} from "../../src/constants.js";
import { createHandoffState, runContinuityHandoff } from "../../src/handoff.js";
import {
	findStalePendingArtifacts,
	footerStatusForMessage,
	formatSettings,
	formatStatus,
	notifyStatus,
	statusHeadlineForConfig,
} from "../../src/status.js";
import {
	decideAutomaticTrigger,
	hasCompleteAssistantToolResultBatch,
	type ContextUsageSnapshot,
} from "../../src/trigger.js";
import { estimateContextTokensFromMessages } from "../../src/pi-internals.js";

type SessionContinuityRegistry = {
	activeRuntimeKeys: WeakSet<object>;
};

const REGISTRY_KEY = Symbol.for("pi-session-continuity.extension-registry");

function singletonRegistry(): SessionContinuityRegistry {
	const globalWithRegistry = globalThis as typeof globalThis & {
		[REGISTRY_KEY]?: SessionContinuityRegistry;
	};
	globalWithRegistry[REGISTRY_KEY] ??= { activeRuntimeKeys: new WeakSet() };
	globalWithRegistry[REGISTRY_KEY].activeRuntimeKeys ??= new WeakSet();
	return globalWithRegistry[REGISTRY_KEY];
}

function runtimeKeyFor(pi: ExtensionAPI): object {
	return (pi as ExtensionAPI & { events?: object }).events ?? (pi as object);
}

export default function sessionContinuityExtension(pi: ExtensionAPI) {
	const registry = singletonRegistry();
	const runtimeKey = runtimeKeyFor(pi);
	if (registry.activeRuntimeKeys.has(runtimeKey)) return;
	registry.activeRuntimeKeys.add(runtimeKey);

	const state = createHandoffState();
	let currentConfig: ResolvedContinuityConfig | undefined;
	let staleNotificationSent = false;
	let usageUnavailableWarningKey: string | undefined;

	pi.registerMessageRenderer(
		"session-continuity-panel",
		(message, _options, theme) => {
			const content =
				typeof message.content === "string" ? message.content : "";
			const [headline = "", ...rest] = content.split("\n");
			const text = [theme.bold(headline), ...rest].join("\n");
			return new Text(text, 1, 1);
		},
	);

	function showCommandOutput(ctx: ExtensionContext, message: string): void {
		if (!ctx.hasUI) {
			process.stdout.write(`${message}\n`);
			return;
		}
		notifyStatus(ctx, message);
	}

	function showCommandPanel(ctx: ExtensionContext, message: string): void {
		if (ctx.hasUI && ctx.mode === "tui") {
			pi.sendMessage({
				customType: "session-continuity-panel",
				content: message,
				display: true,
				details: { product: PRODUCT_NAME },
			});
			ctx.ui.setStatus("session-continuity", footerStatusForMessage(message));
			return;
		}
		showCommandOutput(ctx, message);
	}

	async function refreshConfig(
		ctx: ExtensionContext,
	): Promise<ResolvedContinuityConfig> {
		currentConfig = await loadConfig(ctx, CONFIG_DIR_NAME);
		return currentConfig;
	}

	function warnIfNativeAutoCompactionEnabled(
		ctx: ExtensionContext,
		config: ResolvedContinuityConfig,
	): void {
		if (!config.enabled || !config.valid || !config.trusted) return;
		const nativeCompaction = detectNativeAutoCompaction(
			ctx.cwd,
			config.trusted,
		);
		if (!nativeCompaction.enabled) return;
		ctx.ui.notify(
			`${PRODUCT_NAME} warning: native Pi auto-compaction is enabled. Reliable automatic Pi Session Continuity handoffs require native auto-compaction disabled because it can run before the disk-backed Continuity Handoff. Recommended project setting: compaction.enabled=false in ${CONFIG_DIR_NAME}/settings.json.`,
			"warning",
		);
	}

	function getContextUsage(
		ctx: ExtensionContext,
	): ContextUsageSnapshot | undefined {
		try {
			return typeof ctx.getContextUsage === "function"
				? ctx.getContextUsage()
				: undefined;
		} catch {
			return undefined;
		}
	}

	function warnUnavailableUsageOnce(
		ctx: ExtensionContext,
		config: ResolvedContinuityConfig,
		reason: "usage-unavailable" | "window-unavailable",
	): void {
		const key = `${ctx.sessionManager.getSessionId()}|${config.configPath}|${config.triggerAtPercent}|${config.keepRecentPercent}|${reason}`;
		if (usageUnavailableWarningKey === key) return;
		usageUnavailableWarningKey = key;
		const detail =
			reason === "usage-unavailable"
				? "context usage is unavailable"
				: "context usage or model window is unavailable";
		ctx.ui.notify(
			`${PRODUCT_NAME}: automatic trigger skipped because ${detail}; suppressing repeated notices for this session/config.`,
			"warning",
		);
	}

	async function saveConfigDraft(
		ctx: ExtensionContext,
		draft: ContinuityConfig,
	): Promise<ResolvedContinuityConfig | undefined> {
		const config = currentConfig ?? (await refreshConfig(ctx));
		const errors = validateConfigDraftForPath(draft, config.configPath);
		if (errors.length > 0) {
			ctx.ui.notify(
				`${PRODUCT_NAME}: settings not saved. ${errors.join("; ")}`,
				"warning",
			);
			return undefined;
		}
		await writeConfigToDisk(config.configPath, draft);
		const refreshed = await refreshConfig(ctx);
		ctx.ui.notify(`${PRODUCT_NAME}: settings saved.`, "info");
		ctx.ui.setStatus(
			"session-continuity",
			footerStatusForMessage(statusHeadlineForConfig(refreshed)),
		);
		return refreshed;
	}

	function triggerPercentChoices(predicate: (value: number) => boolean) {
		return Array.from({ length: 10 }, (_, index) => 50 + index * 5)
			.filter(predicate)
			.map((value) => `${value}%`);
	}

	function keepPercentChoices(predicate: (value: number) => boolean) {
		return [5, 10, 15, 20, 25].filter(predicate).map((value) => `${value}%`);
	}

	async function openSettingsMenu(
		ctx: ExtensionContext,
		initialConfig: ResolvedContinuityConfig,
	): Promise<void> {
		if (!ctx.hasUI || ctx.mode !== "tui" || !initialConfig.trusted) {
			showCommandPanel(ctx, formatSettings(initialConfig));
			return;
		}

		let config = initialConfig;
		for (;;) {
			const choice = await ctx.ui.select("Pi Session Continuity settings", [
				`Enabled: ${config.enabled ? "on" : "off"}`,
				`Trigger threshold: ${config.triggerAtPercent}%`,
				`Keep after handoff: ${config.keepRecentPercent}%`,
				`Synthesis model: ${config.synthesisModel}`,
				`Synthesis effort: ${config.synthesisEffort}`,
				`Artifact directory: ${config.artifactDirectory}`,
				"Done",
			]);
			if (!choice || choice === "Done") return;

			const draft = publicConfigFromResolved(config);
			if (choice.startsWith("Enabled:")) {
				const enabled = await ctx.ui.select("Enable automatic handoffs?", [
					"on",
					"off",
				]);
				if (!enabled) continue;
				draft.enabled = enabled === "on";
			} else if (choice.startsWith("Trigger threshold:")) {
				const trigger = await ctx.ui.select(
					"Trigger when context reaches",
					triggerPercentChoices((value) => value > draft.keepRecentPercent),
				);
				if (!trigger) continue;
				draft.triggerAtPercent = Number.parseInt(trigger, 10);
			} else if (choice.startsWith("Keep after handoff:")) {
				const keep = await ctx.ui.select(
					"Keep recent context after handoff",
					keepPercentChoices((value) => value < draft.triggerAtPercent),
				);
				if (!keep) continue;
				draft.keepRecentPercent = Number.parseInt(keep, 10);
			} else if (choice.startsWith("Synthesis model:")) {
				const model = await ctx.ui.input(
					'Synthesis model ("inherit" or provider/model)',
					config.synthesisModel,
				);
				if (!model) continue;
				draft.synthesisModel = model.trim();
			} else if (choice.startsWith("Synthesis effort:")) {
				const effort = await ctx.ui.select("Synthesis effort", [
					"inherit",
					"minimal",
					"low",
					"medium",
					"high",
					"xhigh",
				]);
				if (!effort) continue;
				draft.synthesisEffort = effort as SynthesisEffort;
			} else if (choice.startsWith("Artifact directory:")) {
				const artifactDirectory = await ctx.ui.input(
					"Artifact directory (relative to Pi config dir unless absolute)",
					config.artifactDirectory,
				);
				if (!artifactDirectory) continue;
				draft.artifactDirectory = artifactDirectory.trim();
			} else {
				notifyStatus(ctx, formatSettings(config));
				continue;
			}

			const refreshed = await saveConfigDraft(ctx, draft);
			if (refreshed) config = refreshed;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		const config = await refreshConfig(ctx);
		if (!config.trusted) {
			notifyStatus(
				ctx,
				`${PRODUCT_NAME}: automatic behavior disabled because project is not trusted. Config path: ${config.configPath}.`,
			);
			return;
		}
		if (!config.valid) {
			notifyStatus(
				ctx,
				`${PRODUCT_NAME} disabled: invalid configuration in ${config.configPath}.`,
			);
			return;
		}

		const stale = await findStalePendingArtifacts(
			config.artifactDirectoryPath,
			ctx.sessionManager.getSessionId(),
		);
		if (stale[0] && !staleNotificationSent) {
			staleNotificationSent = true;
			const lockDetail = stale[0].lockPath ? ` lock: ${stale[0].lockPath}` : "";
			ctx.ui.notify(
				`${PRODUCT_NAME}: stale pending Continuity Brief found for this session; leaving it inert. ${stale[0].path}${lockDetail}`,
				"warning",
			);
		}
		warnIfNativeAutoCompactionEnabled(ctx, config);
		notifyStatus(ctx, statusHeadlineForConfig(config));
	});

	pi.on("context", async (event, ctx) => {
		if (!hasCompleteAssistantToolResultBatch(event.messages)) return;

		const config = currentConfig ?? (await refreshConfig(ctx));

		// Estimate real context tokens from the messages that will be sent to the
		// provider, not the stale ctx.getContextUsage() value that only reflects
		// the last assistant response. This mirrors pi-continue's mid-run guard
		// and is the reason the trigger actually fires at 75% in production.
		const contextWindow = ctx.model?.contextWindow ?? 0;
		const estimate = await estimateContextTokensFromMessages(event.messages);
		const usage: ContextUsageSnapshot | undefined =
			estimate !== null
				? { tokens: estimate.tokens, contextWindow }
				: getContextUsage(ctx);

		const decision = decideAutomaticTrigger(config, usage);
		if (!decision.shouldRun) {
			if (
				decision.reason === "usage-unavailable" ||
				decision.reason === "window-unavailable"
			) {
				warnUnavailableUsageOnce(ctx, config, decision.reason);
			}
			return;
		}
		if (
			state.lastAutomaticFailureAt &&
			Date.now() - state.lastAutomaticFailureAt < AUTOMATIC_FAILURE_COOLDOWN_MS
		) {
			return;
		}

		// Abort the active agent run before handoff so the next provider request
		// does not race with synthesis and compaction. This mirrors pi-continue's
		// mid-run guard: abort first, then write brief, compact, and resume.
		ctx.abort();

		ctx.ui.notify(
			`${PRODUCT_NAME}: context threshold reached; preparing Continuity Handoff.`,
			"info",
		);
		await runContinuityHandoff(pi, ctx, config, state, {
			reason: "threshold",
			requestCompaction: true,
		});
	});

	pi.on("session_shutdown", () => {
		registry.activeRuntimeKeys.delete(runtimeKey);
	});

	async function showStatusPanel(
		ctx: ExtensionContext,
		config: ResolvedContinuityConfig,
	): Promise<void> {
		const stale = config.trusted
			? await findStalePendingArtifacts(
					config.artifactDirectoryPath,
					ctx.sessionManager.getSessionId(),
				)
			: [];
		const stalePath = stale[0]
			? `${stale[0].path}${stale[0].lockPath ? ` (lock: ${stale[0].lockPath})` : ""}`
			: undefined;
		showCommandPanel(ctx, formatStatus(config, state, stalePath));
	}

	async function runManualCheckpoint(
		ctx: ExtensionContext,
		config: ResolvedContinuityConfig,
	): Promise<void> {
		if (!config.trusted) {
			showCommandOutput(
				ctx,
				`${PRODUCT_NAME}: checkpoint disabled because project is not trusted. Config path: ${config.configPath}.`,
			);
			return;
		}
		if (!config.valid) {
			showCommandOutput(
				ctx,
				`${PRODUCT_NAME} disabled: invalid configuration in ${config.configPath}.`,
			);
			return;
		}
		if (!config.enabled) {
			showCommandOutput(ctx, `${PRODUCT_NAME}: disabled by configuration.`);
			return;
		}
		await runContinuityHandoff(pi, ctx, config, state, {
			reason: "manual",
			requestCompaction: false,
		});
	}

	async function openTopLevelMenu(
		ctx: ExtensionContext,
		config: ResolvedContinuityConfig,
	): Promise<void> {
		if (!ctx.hasUI || ctx.mode !== "tui") {
			showCommandOutput(
				ctx,
				`${PRODUCT_NAME}: use /continuity status, /continuity checkpoint, or /continuity settings.`,
			);
			return;
		}
		const choice = await ctx.ui.select("Pi Session Continuity", [
			"Status",
			"Create checkpoint now",
			"Settings",
			"Done",
		]);
		if (!choice || choice === "Done") return;
		if (choice === "Status") {
			await showStatusPanel(ctx, config);
			return;
		}
		if (choice === "Create checkpoint now") {
			await runManualCheckpoint(ctx, config);
			return;
		}
		if (choice === "Settings") await openSettingsMenu(ctx, config);
	}

	pi.registerCommand("continuity", {
		description: "Pi Session Continuity: status, checkpoint, and settings",
		getArgumentCompletions(prefix) {
			return ["status", "checkpoint", "settings"]
				.filter((item) => item.startsWith(prefix))
				.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			const tokens = args.trim().split(/\s+/).filter(Boolean);
			const subcommand = tokens[0];
			const config = await refreshConfig(ctx);

			if (!subcommand) {
				await openTopLevelMenu(ctx, config);
				return;
			}

			if (subcommand === "status") {
				await showStatusPanel(ctx, config);
				return;
			}

			if (subcommand === "settings") {
				await openSettingsMenu(ctx, config);
				return;
			}

			if (subcommand === "checkpoint") {
				await runManualCheckpoint(ctx, config);
				return;
			}

			showCommandOutput(
				ctx,
				`${PRODUCT_NAME}: unknown subcommand '${subcommand}'. Use /continuity status, /continuity checkpoint, or /continuity settings.`,
			);
		},
	});
}
