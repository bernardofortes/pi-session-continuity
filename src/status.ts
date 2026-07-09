import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildArtifactPaths } from "./artifact.js";
import type { ResolvedContinuityConfig } from "./config.js";
import { PRODUCT_NAME } from "./constants.js";
import type { HandoffState } from "./handoff.js";

export interface StalePendingArtifact {
	path: string;
	modifiedMs: number;
	lockPath?: string;
}

export async function findStalePendingArtifacts(
	artifactDirectory: string,
	sessionId: string,
): Promise<StalePendingArtifact[]> {
	const paths = buildArtifactPaths(artifactDirectory, sessionId, "placeholder");
	try {
		const names = await readdir(paths.pendingDir);
		const artifacts = await Promise.all(
			names
				.filter((name) => name.endsWith(".md"))
				.map(async (name) => {
					const path = join(paths.pendingDir, name);
					const info = await stat(path);
					const eventId = name.replace(/\.md$/, "");
					const lockPath = join(paths.lockDir, `${eventId}.json`);
					try {
						await stat(lockPath);
						return { path, modifiedMs: info.mtimeMs, lockPath };
					} catch {
						return { path, modifiedMs: info.mtimeMs };
					}
				}),
		);
		return artifacts.sort((a, b) => b.modifiedMs - a.modifiedMs);
	} catch {
		return [];
	}
}

export function formatStatus(
	config: ResolvedContinuityConfig,
	state: HandoffState,
	stalePendingPath?: string,
): string {
	const headline = !config.trusted
		? `${PRODUCT_NAME}: automatic behavior disabled because project is not trusted.`
		: !config.valid
			? `${PRODUCT_NAME} disabled: invalid configuration in ${config.configPath}.`
			: config.enabled
				? `${PRODUCT_NAME}: enabled · trigger ${config.triggerAtPercent}% · keep ${config.keepRecentPercent}%.`
				: `${PRODUCT_NAME}: disabled by configuration.`;
	const lines = [
		headline,
		"",
		"Status",
		`- Mode: ${config.enabled && config.valid && config.trusted ? "Enabled" : "Disabled"}`,
		`- Trigger threshold: ${config.triggerAtPercent}% of the active context window`,
		`- Keep after handoff: ${config.keepRecentPercent}% of the active context window`,
		`- Synthesis model: ${config.synthesisModel}`,
		`- Synthesis effort: ${config.synthesisEffort}`,
		`- Artifacts: ${config.artifactDirectoryPath}`,
		`- Active operation: ${state.activeOperation ?? "none"}`,
		`- Last checkpoint: ${state.lastCheckpointAt ?? "none"}`,
		`- Last artifact: ${state.lastArtifactPath ?? "none"}`,
		`- Last failure: ${state.lastFailure ?? "none"}`,
	];
	if (config.disabledReason)
		lines.push(`- Disabled reason: ${config.disabledReason}`);
	if (stalePendingPath)
		lines.push(`- Stale pending artifact: ${stalePendingPath}`);
	return lines.join("\n");
}

export function formatSettings(config: ResolvedContinuityConfig): string {
	return [
		`${PRODUCT_NAME}: settings`,
		"",
		"Config",
		`- Enabled: ${config.enabled ? "on" : "off"}`,
		`- Trigger threshold: ${config.triggerAtPercent}%`,
		`- Keep after handoff: ${config.keepRecentPercent}%`,
		`- Synthesis model: ${config.synthesisModel}`,
		`- Synthesis effort: ${config.synthesisEffort}`,
		`- Artifact directory: ${config.artifactDirectory}`,
		`- Resolved artifacts: ${config.artifactDirectoryPath}`,
		`- Config path: ${config.configPath}`,
		`- Disabled reason: ${config.disabledReason ?? "none"}`,
	].join("\n");
}

export function notificationLevelForMessage(
	message: string,
): "info" | "warning" {
	const headline = message.split("\n")[0]?.toLowerCase() ?? "";
	return headline.includes("disabled") ||
		headline.includes("failed") ||
		headline.includes("invalid") ||
		headline.includes("untrusted")
		? "warning"
		: "info";
}

export function footerStatusForMessage(message: string): string {
	const headline = message.split("\n")[0] ?? "";
	const threshold = headline.match(/trigger (\d+)% · keep (\d+)%/);
	if (threshold) return `PSC ${threshold[1]}/${threshold[2]}`;
	const normalized = headline.toLowerCase();
	if (normalized.includes("settings")) return "PSC settings";
	if (normalized.includes("checkpoint") || normalized.includes("handoff"))
		return "PSC handoff";
	if (normalized.includes("failed")) return "PSC failed";
	if (normalized.includes("disabled")) return "PSC disabled";
	return "PSC ready";
}

export function notifyStatus(ctx: ExtensionContext, message: string): void {
	const level = notificationLevelForMessage(message);
	ctx.ui.setWidget("session-continuity", undefined);
	ctx.ui.notify(message, level);
	ctx.ui.setStatus("session-continuity", footerStatusForMessage(message));
}
