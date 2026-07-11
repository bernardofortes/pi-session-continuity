import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export interface ContextTokenEstimate {
	tokens: number;
	usageTokens: number;
	trailingTokens: number;
	lastUsageIndex: number | null;
}

interface PiCompactionInternals {
	estimateContextTokens: (messages: unknown[]) => ContextTokenEstimate;
}

let cachedInternals: PiCompactionInternals | undefined;

/**
 * Load Pi's internal compaction helpers at runtime.
 *
 * `estimateContextTokens` is not exported from the main package entry point,
 * so we resolve it from the installed dist tree the same way pi-continue does.
 * This gives us a real-time token estimate of the messages that will be sent
 * to the provider, instead of the stale `ctx.getContextUsage()` value that
 * only reflects the last assistant response.
 */
export async function loadPiCompactionInternals(): Promise<PiCompactionInternals> {
	if (cachedInternals) return cachedInternals;
	const packageEntryPath = require.resolve("@earendil-works/pi-coding-agent");
	const distRoot = dirname(packageEntryPath);
	const compactionModule = await import(
		pathToFileURL(join(distRoot, "core", "compaction", "compaction.js")).href
	);
	cachedInternals = {
		estimateContextTokens: compactionModule.estimateContextTokens,
	};
	return cachedInternals;
}

/**
 * Estimate context tokens from the real messages that will be sent to the
 * provider. Returns null if the estimate cannot be computed.
 */
export async function estimateContextTokensFromMessages(
	messages: unknown[],
): Promise<ContextTokenEstimate | null> {
	try {
		const internals = await loadPiCompactionInternals();
		return internals.estimateContextTokens(messages);
	} catch {
		return null;
	}
}
