import type { ResolvedContinuityConfig } from "./config.js";
import { shouldTriggerHandoff } from "./config.js";

export interface ContextUsageSnapshot {
	tokens: number | null;
	contextWindow: number;
}

export type AutomaticTriggerDecision =
	| { shouldRun: true; reason: "threshold-reached" }
	| {
			shouldRun: false;
			reason:
				| "disabled"
				| "invalid-config"
				| "untrusted"
				| "usage-unavailable"
				| "window-unavailable"
				| "below-threshold";
	  };

export function decideAutomaticTrigger(
	config: ResolvedContinuityConfig,
	usage: ContextUsageSnapshot | undefined,
): AutomaticTriggerDecision {
	if (!config.trusted) return { shouldRun: false, reason: "untrusted" };
	if (!config.valid) return { shouldRun: false, reason: "invalid-config" };
	if (!config.enabled) return { shouldRun: false, reason: "disabled" };
	if (!usage) return { shouldRun: false, reason: "usage-unavailable" };
	if (usage.tokens === null || usage.contextWindow <= 0) {
		return { shouldRun: false, reason: "window-unavailable" };
	}
	return shouldTriggerHandoff(
		usage.tokens,
		usage.contextWindow,
		config.triggerAtPercent,
	)
		? { shouldRun: true, reason: "threshold-reached" }
		: { shouldRun: false, reason: "below-threshold" };
}
