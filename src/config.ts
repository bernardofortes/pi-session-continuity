import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
	getAgentDir,
	SettingsManager,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_ARTIFACT_DIRECTORY,
	DEFAULT_KEEP_RECENT_PERCENT,
	DEFAULT_SYNTHESIS_EFFORT,
	DEFAULT_SYNTHESIS_MODEL,
	DEFAULT_TRIGGER_AT_PERCENT,
} from "./constants.js";

export type SynthesisEffort =
	| "inherit"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";

export interface ContinuityConfig {
	enabled: boolean;
	triggerAtPercent: number;
	keepRecentPercent: number;
	synthesisModel: string;
	synthesisEffort: SynthesisEffort;
	artifactDirectory: string;
}

export interface ResolvedContinuityConfig extends ContinuityConfig {
	configPath: string;
	artifactDirectoryPath: string;
	trusted: boolean;
	valid: boolean;
	disabledReason?: string;
	errors: string[];
}

export interface NativeCompactionStatus {
	enabled: boolean;
	reserveTokens: number;
	keepRecentTokens: number;
	errors: string[];
}

export const DEFAULT_CONFIG: ContinuityConfig = {
	enabled: true,
	triggerAtPercent: DEFAULT_TRIGGER_AT_PERCENT,
	keepRecentPercent: DEFAULT_KEEP_RECENT_PERCENT,
	synthesisModel: DEFAULT_SYNTHESIS_MODEL,
	synthesisEffort: DEFAULT_SYNTHESIS_EFFORT as SynthesisEffort,
	artifactDirectory: DEFAULT_ARTIFACT_DIRECTORY,
};

export function publicConfigFromResolved(
	config: ResolvedContinuityConfig,
): ContinuityConfig {
	return {
		enabled: config.enabled,
		triggerAtPercent: config.triggerAtPercent,
		keepRecentPercent: config.keepRecentPercent,
		synthesisModel: config.synthesisModel,
		synthesisEffort: config.synthesisEffort,
		artifactDirectory: config.artifactDirectory,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SYNTHESIS_EFFORTS = new Set<SynthesisEffort>([
	"inherit",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);

export function isSynthesisEffort(value: string): value is SynthesisEffort {
	return SYNTHESIS_EFFORTS.has(value as SynthesisEffort);
}

export function validateConfig(
	raw: unknown,
	configPath: string,
): { config?: ContinuityConfig; errors: string[] } {
	const errors: string[] = [];
	if (!isRecord(raw)) {
		return { errors: [`${configPath}: configuration must be a JSON object`] };
	}

	const config: ContinuityConfig = { ...DEFAULT_CONFIG };

	if (raw.enabled !== undefined) {
		if (typeof raw.enabled !== "boolean")
			errors.push("enabled must be a boolean");
		else config.enabled = raw.enabled;
	}

	if (raw.triggerAtPercent !== undefined) {
		if (
			typeof raw.triggerAtPercent !== "number" ||
			!Number.isFinite(raw.triggerAtPercent)
		) {
			errors.push("triggerAtPercent must be a finite number");
		} else {
			config.triggerAtPercent = raw.triggerAtPercent;
		}
	}

	if (raw.keepRecentPercent !== undefined) {
		if (
			typeof raw.keepRecentPercent !== "number" ||
			!Number.isFinite(raw.keepRecentPercent)
		) {
			errors.push("keepRecentPercent must be a finite number");
		} else {
			config.keepRecentPercent = raw.keepRecentPercent;
		}
	}

	if (raw.synthesisModel !== undefined) {
		if (
			typeof raw.synthesisModel !== "string" ||
			raw.synthesisModel.trim() === ""
		) {
			errors.push(
				'synthesisModel must be "inherit" or a provider/model string',
			);
		} else {
			config.synthesisModel = raw.synthesisModel.trim();
		}
	}

	if (raw.synthesisEffort !== undefined) {
		const effort =
			typeof raw.synthesisEffort === "string" ? raw.synthesisEffort.trim() : "";
		if (!isSynthesisEffort(effort)) {
			errors.push(
				'synthesisEffort must be one of "inherit", "minimal", "low", "medium", "high", or "xhigh"',
			);
		} else {
			config.synthesisEffort = effort;
		}
	}

	if (raw.artifactDirectory !== undefined) {
		if (
			typeof raw.artifactDirectory !== "string" ||
			raw.artifactDirectory.trim() === ""
		) {
			errors.push("artifactDirectory must be a non-empty string");
		} else {
			config.artifactDirectory = raw.artifactDirectory.trim();
		}
	}

	if (config.triggerAtPercent <= 0 || config.triggerAtPercent >= 100) {
		errors.push("triggerAtPercent must be positive and below 100");
	}
	if (config.keepRecentPercent <= 0 || config.keepRecentPercent >= 100) {
		errors.push("keepRecentPercent must be positive and below 100");
	}
	if (config.keepRecentPercent >= config.triggerAtPercent) {
		errors.push("keepRecentPercent must be lower than triggerAtPercent");
	}
	if (
		config.synthesisModel !== "inherit" &&
		!config.synthesisModel.includes("/")
	) {
		errors.push(
			'synthesisModel must be "inherit" or a concrete provider/model id',
		);
	}

	return errors.length > 0 ? { errors } : { config, errors: [] };
}

export function resolveArtifactDirectoryPath(
	configRoot: string,
	artifactDirectory: string,
	configPath: string,
): { artifactDirectoryPath?: string; errors: string[] } {
	if (isAbsolute(artifactDirectory)) {
		return { artifactDirectoryPath: artifactDirectory, errors: [] };
	}

	const artifactDirectoryPath = resolve(configRoot, artifactDirectory);
	const relativeArtifactPath = relative(configRoot, artifactDirectoryPath);
	if (
		relativeArtifactPath === ".." ||
		relativeArtifactPath.startsWith("../") ||
		isAbsolute(relativeArtifactPath)
	) {
		return {
			errors: [
				`${configPath}: artifactDirectory must resolve under ${configRoot} unless absolute`,
			],
		};
	}

	return { artifactDirectoryPath, errors: [] };
}

export function validateConfigDraftForPath(
	config: ContinuityConfig,
	configPath: string,
): string[] {
	const validation = validateConfig(config, configPath);
	if (!validation.config) return validation.errors;
	const resolved = resolveArtifactDirectoryPath(
		dirname(configPath),
		validation.config.artifactDirectory,
		configPath,
	);
	return resolved.errors;
}

export async function writeConfigToDisk(
	configPath: string,
	config: ContinuityConfig,
): Promise<void> {
	const errors = validateConfigDraftForPath(config, configPath);
	if (errors.length > 0) {
		throw new Error(errors.join("; "));
	}
	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(
		`${configPath}`,
		`${JSON.stringify(config, null, "\t")}\n`,
		"utf8",
	);
}

export async function loadConfigFromDisk(
	cwd: string,
	configDirName: string,
	trusted: boolean,
): Promise<ResolvedContinuityConfig> {
	const configPath = join(cwd, configDirName, "session-continuity.json");

	if (!trusted) {
		const artifactDirectoryPath = resolve(
			cwd,
			configDirName,
			DEFAULT_ARTIFACT_DIRECTORY,
		);
		return {
			...DEFAULT_CONFIG,
			configPath,
			artifactDirectoryPath,
			trusted,
			valid: false,
			enabled: false,
			disabledReason: "project is not trusted",
			errors: [
				`Project-local config is ignored until the project is trusted: ${configPath}`,
			],
		};
	}

	let raw: unknown = DEFAULT_CONFIG;
	if (existsSync(configPath)) {
		try {
			raw = JSON.parse(await readFile(configPath, "utf8"));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				...DEFAULT_CONFIG,
				configPath,
				artifactDirectoryPath: resolve(
					cwd,
					configDirName,
					DEFAULT_ARTIFACT_DIRECTORY,
				),
				trusted,
				valid: false,
				enabled: false,
				disabledReason: `invalid configuration in ${configPath}`,
				errors: [`${configPath}: ${message}`],
			};
		}
	}

	const validation = validateConfig(raw, configPath);
	if (!validation.config) {
		return {
			...DEFAULT_CONFIG,
			configPath,
			artifactDirectoryPath: resolve(
				cwd,
				configDirName,
				DEFAULT_ARTIFACT_DIRECTORY,
			),
			trusted,
			valid: false,
			enabled: false,
			disabledReason: `invalid configuration in ${configPath}`,
			errors: validation.errors,
		};
	}

	const resolvedArtifactDirectory = resolveArtifactDirectoryPath(
		resolve(cwd, configDirName),
		validation.config.artifactDirectory,
		configPath,
	);
	if (!resolvedArtifactDirectory.artifactDirectoryPath) {
		return {
			...validation.config,
			configPath,
			artifactDirectoryPath: resolve(
				cwd,
				configDirName,
				DEFAULT_ARTIFACT_DIRECTORY,
			),
			trusted,
			valid: false,
			enabled: false,
			disabledReason: `invalid configuration in ${configPath}`,
			errors: resolvedArtifactDirectory.errors,
		};
	}

	const artifactDirectoryPath = resolvedArtifactDirectory.artifactDirectoryPath;

	return {
		...validation.config,
		configPath,
		artifactDirectoryPath,
		trusted,
		valid: true,
		errors: [],
	};
}

export async function loadConfig(
	ctx: ExtensionContext,
	configDirName: string,
): Promise<ResolvedContinuityConfig> {
	return loadConfigFromDisk(ctx.cwd, configDirName, ctx.isProjectTrusted());
}

export function detectNativeAutoCompaction(
	cwd: string,
	projectTrusted: boolean,
	agentDir = getAgentDir(),
): NativeCompactionStatus {
	const settingsManager = SettingsManager.create(cwd, agentDir, {
		projectTrusted,
	});
	const settings = settingsManager.getCompactionSettings();
	const errors = settingsManager
		.drainErrors()
		.map(({ scope, error }) => `${scope}: ${error.message}`);
	return {
		enabled: settings.enabled,
		reserveTokens: settings.reserveTokens,
		keepRecentTokens: settings.keepRecentTokens,
		errors,
	};
}

export function deriveKeepRecentTokens(
	contextWindow: number,
	keepRecentPercent: number,
): number {
	return Math.floor((contextWindow * keepRecentPercent) / 100);
}

export function shouldTriggerHandoff(
	tokens: number | null,
	contextWindow: number,
	triggerAtPercent: number,
): boolean {
	if (
		tokens === null ||
		!Number.isFinite(tokens) ||
		!Number.isFinite(contextWindow) ||
		contextWindow <= 0
	) {
		return false;
	}
	return tokens / contextWindow >= triggerAtPercent / 100;
}
