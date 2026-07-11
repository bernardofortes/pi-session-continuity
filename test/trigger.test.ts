import { describe, expect, it } from "vitest";
import type { ResolvedContinuityConfig } from "../src/config.js";
import {
	decideAutomaticTrigger,
	hasCompleteAssistantToolResultBatch,
} from "../src/trigger.js";

function config(
	overrides: Partial<ResolvedContinuityConfig> = {},
): ResolvedContinuityConfig {
	return {
		enabled: true,
		triggerAtPercent: 75,
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

function assistantWithToolCalls(ids: string[]) {
	return {
		role: "assistant" as const,
		content: ids.map((id) => ({
			type: "toolCall" as const,
			id,
			name: `tool_${id}`,
			arguments: {},
		})),
		api: "openai" as const,
		provider: "openai" as const,
		model: "model",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse" as const,
		timestamp: 1,
	};
}

function toolResult(id: string) {
	return {
		role: "toolResult" as const,
		toolCallId: id,
		toolName: `tool_${id}`,
		content: [{ type: "text" as const, text: "done" }],
		isError: false,
		timestamp: 2,
	};
}

describe("safe-boundary assistant/tool-result batch detection", () => {
	it("accepts a complete assistant tool-call batch followed by matching tool results", () => {
		expect(
			hasCompleteAssistantToolResultBatch([
				{ role: "user", content: "do work", timestamp: 0 },
				assistantWithToolCalls(["a", "b"]),
				toolResult("a"),
				toolResult("b"),
			]),
		).toBe(true);
	});

	it("rejects incomplete, extra, duplicate, out-of-order, and non-batch tails", () => {
		expect(
			hasCompleteAssistantToolResultBatch([
				assistantWithToolCalls(["a", "b"]),
				toolResult("a"),
			]),
		).toBe(false);
		expect(
			hasCompleteAssistantToolResultBatch([
				assistantWithToolCalls(["a"]),
				toolResult("a"),
				toolResult("b"),
			]),
		).toBe(false);
		expect(
			hasCompleteAssistantToolResultBatch([
				assistantWithToolCalls(["a", "b"]),
				toolResult("b"),
				toolResult("a"),
			]),
		).toBe(false);
		expect(
			hasCompleteAssistantToolResultBatch([
				assistantWithToolCalls(["a"]),
				{ ...toolResult("a"), toolName: "" },
			]),
		).toBe(false);
		expect(
			hasCompleteAssistantToolResultBatch([
				assistantWithToolCalls(["a"]),
				{ role: "user", content: "next", timestamp: 3 },
			]),
		).toBe(false);
	});
});

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
				tokens: 95_999,
				contextWindow: 128_000,
			}),
		).toEqual({ shouldRun: false, reason: "below-threshold" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 96_000,
				contextWindow: 128_000,
			}),
		).toEqual({ shouldRun: true, reason: "threshold-reached" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 749_999,
				contextWindow: 1_000_000,
			}),
		).toEqual({ shouldRun: false, reason: "below-threshold" });
		expect(
			decideAutomaticTrigger(config(), {
				tokens: 750_000,
				contextWindow: 1_000_000,
			}),
		).toEqual({ shouldRun: true, reason: "threshold-reached" });
	});
});
