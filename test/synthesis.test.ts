import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { synthesizeWithModel } from "../src/handoff.js";

const completeSimpleMock = vi.hoisted(() => vi.fn());

vi.mock("@earendil-works/pi-ai/compat", () => ({
	completeSimple: completeSimpleMock,
}));

const model: Model<Api> = {
	id: "gpt-5.5",
	name: "GPT 5.5",
	api: "openai-codex-responses",
	provider: "openai-codex",
	baseUrl: "https://example.invalid",
	reasoning: true,
	thinkingLevelMap: { medium: "medium" },
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 272_000,
	maxTokens: 131_072,
};

function ctx(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
	return {
		model,
		modelRegistry: {
			find: vi.fn(() => model),
			getApiKeyAndHeaders: vi.fn(async () => ({
				ok: true,
				apiKey: "test-key",
				headers: { "x-test": "1" },
				env: { TEST_ENV: "1" },
			})),
		},
		signal: undefined,
		...overrides,
	} as unknown as ExtensionContext;
}

const config = {
	synthesisModel: "openai-codex/gpt-5.5",
	synthesisEffort: "medium",
} as const;

const frontmatter = {
	eventId: "event-a",
	sessionId: "session-a",
	modelId: "openai-codex/gpt-5.5",
	synthesisModel: "openai-codex/gpt-5.5",
} as never;

const assistantResponse = {
	role: "assistant",
	content: [{ type: "text", text: "# Continuity Brief\n\n## Task\nDone." }],
	api: "openai-codex-responses",
	provider: "openai-codex",
	model: "gpt-5.5",
	usage: {
		input: 1,
		output: 2,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 3,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "stop",
	timestamp: Date.now(),
};

describe("Continuity Brief synthesis model call", () => {
	beforeEach(() => {
		completeSimpleMock.mockReset();
		completeSimpleMock.mockResolvedValue(assistantResponse);
	});

	it("uses Pi's simple model adapter with system prompt, clamped reasoning, and output budget", async () => {
		const text = await synthesizeWithModel(
			{
				frontmatter,
				conversationText: "[User]: continue this work",
				systemPrompt: "active system prompt",
			},
			ctx(),
			config as never,
		);

		expect(text).toContain("# Continuity Brief");
		expect(completeSimpleMock).toHaveBeenCalledTimes(1);
		const [calledModel, context, options] = completeSimpleMock.mock.calls[0];
		expect(calledModel).toBe(model);
		expect(context.systemPrompt).toContain("Pi Session Continuity");
		expect(context.messages[0].content[0].text).toContain(
			"Serialized conversation/tool transcript material",
		);
		expect(context.messages[0].content[0].text).toContain(
			"[User]: continue this work",
		);
		expect(options.maxTokens).toBe(32_768);
		expect(options.reasoning).toBe("medium");
		expect(options.apiKey).toBe("test-key");
	});

	it("bounds oversized transcript material before calling the synthesis provider", async () => {
		const oldestMarker = "OLDEST_SYNTHESIS_MARKER";
		const recentMarker = "RECENT_SYNTHESIS_MARKER";
		await synthesizeWithModel(
			{
				frontmatter,
				conversationText: `${oldestMarker}\n${"OLDER_SYNTHESIS_MATERIAL".repeat(40_000)}\n${recentMarker}`,
				systemPrompt: "active system prompt",
			},
			ctx(),
			config as never,
		);

		const [, context] = completeSimpleMock.mock.calls[0];
		const prompt = context.messages[0].content[0].text;
		expect(prompt).toContain("synthesis input bounded");
		expect(prompt).toContain(recentMarker);
		expect(prompt).not.toContain(oldestMarker);
		expect(prompt.length).toBeLessThan(450_000);
	});

	it("reports empty model output with stop reason and token details", async () => {
		completeSimpleMock.mockResolvedValue({
			...assistantResponse,
			content: [{ type: "thinking", thinking: "reasoned internally" }],
			usage: { ...assistantResponse.usage, output: 128, reasoning: 128 },
		});

		await expect(
			synthesizeWithModel(
				{
					frontmatter,
					conversationText: "[User]: continue this work",
					systemPrompt: "active system prompt",
				},
				ctx(),
				config as never,
			),
		).rejects.toThrow(
			"synthesis model returned an empty Continuity Brief (stopReason=stop, 128 output tokens, 128 reasoning tokens)",
		);
	});
});
