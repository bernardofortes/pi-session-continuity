import { describe, expect, it } from "vitest";
import type { ResolvedContinuityConfig } from "../src/config.js";
import { decideAutomaticTrigger } from "../src/trigger.js";

function config(
	overrides: Partial<ResolvedContinuityConfig> = {},
): ResolvedContinuityConfig {
	return {
		enabled: true,
		triggerAtPercent: 70,
		keepRecentPercent: 20,
		synthesisModel: "inherit",
		synthesisEffort: "medium",
		artifactDirectory: "session-continuity",
		configPath: "/workspace/.pi/session-continuity.json",
		artifactDirectoryPath: "/workspace/.pi/session-continuity",
		trusted: true,
		valid: true,
		errors: [],
		...overrides,
	};
}

describe("automatic threshold trigger decisions", () => {
	it("skips disabled, untrusted, invalid, and unavailable usage states", () => {
		expect(
			decideAutomaticTrigger(config({ enabled: false }), {
				tokens: 650,
				contextWindow: 1000,
			}),
		).toEqual({ shouldRun: false, reason: "disabled" });
		expect(
			decideAutomaticTrigger(config({ trusted: false }), {
				tokens: 650,
				contextWindow: 1000,
			}),
		).toEqual({ shouldRun: false, reason: "untrusted" });
		expect(
			decideAutomaticTrigger(config({ valid: false }), {
				tokens: 650,
				contextWindow: 1000,
			}),
		).toEqual({ shouldRun: false, reason: "invalid-config" });
		expect(decideAutomaticTrigger(config(), undefined)).toEqual({
			shouldRun: false,
			reason: "usage-unavailable",
		});
		expect(
			decideAutomaticTrigger(config(), { tokens: null, contextWindow: 1000 }),
		).toEqual({ shouldRun: false, reason: "window-unavailable" });
		expect(
			decideAutomaticTrigger(config(), { tokens: 750, contextWindow: 0 }),
		).toEqual({ shouldRun: false, reason: "window-unavailable" });
	});

	it("fires at the configured percentage across model windows", () => {
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 89_599,
				contextWindow: 128_000,
			}),
		).toEqual({ shouldRun: false, reason: "below-threshold" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 89_600,
				contextWindow: 128_000,
			}),
		).toEqual({ shouldRun: true, reason: "threshold-reached" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 699_999,
				contextWindow: 1_000_000,
			}),
		).toEqual({ shouldRun: false, reason: "below-threshold" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 700_000,
				contextWindow: 1_000_000,
			}),
		).toEqual({ shouldRun: true, reason: "threshold-reached" });
	});
});
