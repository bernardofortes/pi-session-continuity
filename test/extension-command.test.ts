import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const VALID_BRIEF_BODY = `# Continuity Brief

## Task
Test task.

## Done When
Done.

## Constraints / Forbid
None known.

## Established Facts
None known.

## Current State

### Done
None known.

### In Progress
None known.

### Blocked
None known.

## Key Decisions
None known.

## Files and Artifacts
None known.

## Validation Evidence
None known.

## Open Questions
None known.

## Next Actions
Continue.

## Do Not Repeat / Lessons Learned
None known.

## Reference Context
None known.

## External State / Assumptions
None known.

## Recovery Instructions
Continue from this brief.`;

vi.mock("@earendil-works/pi-ai/compat", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@earendil-works/pi-ai/compat")>();
	return {
		...actual,
		completeSimple: vi.fn(async () => ({
			stopReason: "stop",
			content: [{ type: "text", text: VALID_BRIEF_BODY }],
			usage: { output: 1 },
		})),
	};
});

import sessionContinuityExtension from "../extensions/session-continuity/index.js";

let dir: string;
const shutdownHandlers: EventHandler[] = [];

type CommandHandler = (
	args: string,
	ctx: ExtensionContext,
) => Promise<void> | void;

type EventHandler = (
	event: unknown,
	ctx: ExtensionContext,
) => Promise<void> | void;

function fakePi(events: object = {}): {
	pi: ExtensionAPI & { events: object };
	sendMessage: ReturnType<typeof vi.fn>;
	commandHandler: () => CommandHandler;
	eventHandler: (name: string) => EventHandler;
} {
	let handler: CommandHandler | undefined;
	const eventHandlers = new Map<string, EventHandler>();
	const sendMessage = vi.fn();
	const pi = {
		events,
		registerMessageRenderer: vi.fn(),
		registerCommand: vi.fn(
			(_name: string, options: { handler: CommandHandler }) => {
				handler = options.handler;
			},
		),
		on: vi.fn((name: string, eventHandler: EventHandler) => {
			eventHandlers.set(name, eventHandler);
			if (name === "session_shutdown") shutdownHandlers.push(eventHandler);
		}),
		sendMessage,
		sendUserMessage: vi.fn(),
	} as unknown as ExtensionAPI & { events: object };
	return {
		pi,
		sendMessage,
		commandHandler: () => {
			if (!handler) throw new Error("continuity command was not registered");
			return handler;
		},
		eventHandler: (name: string) => {
			const eventHandler = eventHandlers.get(name);
			if (!eventHandler) throw new Error(`${name} handler was not registered`);
			return eventHandler;
		},
	};
}

function fakeCtx(
	overrides: Partial<ExtensionContext> = {},
): ExtensionContext & {
	ui: ExtensionContext["ui"] & {
		notify: ReturnType<typeof vi.fn>;
		select: ReturnType<typeof vi.fn>;
		setStatus: ReturnType<typeof vi.fn>;
		setWidget: ReturnType<typeof vi.fn>;
	};
	compact: ReturnType<typeof vi.fn>;
} {
	const context = {
		cwd: dir,
		mode: "tui",
		hasUI: true,
		signal: new AbortController().signal,
		isProjectTrusted: () => true,
		ui: {
			notify: vi.fn(),
			setStatus: vi.fn(),
			setWidget: vi.fn(),
			select: vi.fn(async () => "Done"),
			input: vi.fn(),
		} as unknown as ExtensionContext["ui"] & {
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
			setWidget: ReturnType<typeof vi.fn>;
		},
		sessionManager: {
			getSessionId: () => "session-a",
			getSessionFile: () => join(dir, "session.jsonl"),
			getLeafId: () => "leaf-a",
			getBranch: () => [],
		} as unknown as ExtensionContext["sessionManager"],
		model: {
			provider: "test",
			id: "model",
			contextWindow: 1000,
			maxTokens: 1000,
		} as never,
		modelRegistry: {
			getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
			find: vi.fn(),
		} as never,
		getContextUsage: () => ({ tokens: 750, contextWindow: 1000, percent: 75 }),
		getSystemPrompt: () => "active system prompt",
		compact: vi.fn((options?: { onComplete?: () => void }) =>
			options?.onComplete?.(),
		),
		...overrides,
	} as ExtensionContext & {
		ui: ExtensionContext["ui"] & {
			notify: ReturnType<typeof vi.fn>;
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
			setWidget: ReturnType<typeof vi.fn>;
		};
		compact: ReturnType<typeof vi.fn>;
	};
	return context;
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "psc-command-"));
});

afterEach(async () => {
	for (const shutdown of shutdownHandlers.splice(0)) {
		await shutdown({}, fakeCtx());
	}
	await rm(dir, { recursive: true, force: true });
});

function safeBoundaryMessages() {
	return [
		{ role: "user" as const, content: "do work", timestamp: 0 },
		{
			role: "assistant" as const,
			content: [
				{
					type: "toolCall" as const,
					id: "call-a",
					name: "tool",
					arguments: {},
				},
			],
			api: "openai" as const,
			provider: "openai" as const,
			model: "model",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			},
			stopReason: "toolUse" as const,
			timestamp: 1,
		},
		{
			role: "toolResult" as const,
			toolCallId: "call-a",
			toolName: "tool",
			content: [{ type: "text" as const, text: "done" }],
			isError: false,
			timestamp: 2,
		},
	];
}

async function flushMicrotasks(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 20));
}

describe("continuity command dispatch", () => {
	it("opens the top-level menu when /continuity is invoked without arguments", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();

		await runtime.commandHandler()("", ctx);

		expect(ctx.ui.select).toHaveBeenCalledWith("Pi Session Continuity", [
			"Status",
			"Create checkpoint now",
			"Settings",
			"Done",
		]);
		expect(ctx.ui.select).not.toHaveBeenCalledWith(
			"Pi Session Continuity settings",
			expect.anything(),
		);
		expect(runtime.sendMessage).not.toHaveBeenCalled();
	});

	it("updates the footer status immediately after settings changes", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();
		ctx.ui.select
			.mockResolvedValueOnce("Trigger threshold: 70%")
			.mockResolvedValueOnce("80%")
			.mockResolvedValueOnce("Done");

		await runtime.commandHandler()("settings", ctx);

		expect(ctx.ui.select).toHaveBeenNthCalledWith(
			2,
			"Trigger when context reaches",
			["50%", "55%", "60%", "65%", "70%", "75%", "80%", "85%", "90%", "95%"],
		);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			"Pi Session Continuity: settings saved.",
			"info",
		);
		expect(ctx.ui.setStatus).toHaveBeenLastCalledWith(
			"session-continuity",
			"Session Continuation @ 80%",
		);
	});

	it("limits keep-after-handoff choices to low retention percentages", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();
		ctx.ui.select
			.mockResolvedValueOnce("Keep after handoff: 20%")
			.mockResolvedValueOnce("25%")
			.mockResolvedValueOnce("Done");

		await runtime.commandHandler()("settings", ctx);

		expect(ctx.ui.select).toHaveBeenNthCalledWith(
			2,
			"Keep recent context after handoff",
			["5%", "10%", "15%", "20%", "25%"],
		);
	});

	it("keeps /continuity status routed to the textual status panel", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();

		await runtime.commandHandler()("status", ctx);

		expect(ctx.ui.select).not.toHaveBeenCalled();
		expect(runtime.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				customType: "session-continuity-panel",
				content: expect.stringContaining("Status"),
			}),
		);
	});

	it("prints /continuity status in non-UI mode", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = {
			...fakeCtx(),
			mode: "print",
			hasUI: false,
		} as ExtensionContext;
		const write = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		try {
			await runtime.commandHandler()("status", ctx);

			expect(runtime.sendMessage).not.toHaveBeenCalled();
			expect(write).toHaveBeenCalledWith(expect.stringContaining("Status\n"));
		} finally {
			write.mockRestore();
		}
	});

	it("warns on session load when native Pi auto-compaction is enabled", async () => {
		await mkdir(join(dir, ".pi"), { recursive: true });
		await writeFile(
			join(dir, ".pi", "settings.json"),
			JSON.stringify({ compaction: { enabled: true } }),
			"utf8",
		);
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();

		await runtime.eventHandler("session_start")({}, ctx);

		expect(ctx.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining("native Pi auto-compaction is enabled"),
			"warning",
		);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining(
				"Reliable automatic Pi Session Continuity handoffs require native auto-compaction disabled",
			),
			"warning",
		);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining("compaction.enabled=false"),
			"warning",
		);
	});

	it("opens the existing settings menu from the top-level menu without duplicating settings items", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();
		ctx.ui.select
			.mockResolvedValueOnce("Settings")
			.mockResolvedValueOnce("Done");

		await runtime.commandHandler()("", ctx);

		expect(ctx.ui.select).toHaveBeenNthCalledWith(1, "Pi Session Continuity", [
			"Status",
			"Create checkpoint now",
			"Settings",
			"Done",
		]);
		expect(ctx.ui.select).toHaveBeenNthCalledWith(
			2,
			"Pi Session Continuity settings",
			expect.arrayContaining(["Done"]),
		);
		expect(ctx.ui.select).toHaveBeenCalledTimes(2);
	});

	it("registers the context hook instead of turn_end and triggers at a complete safe boundary", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();

		expect(runtime.pi.on).toHaveBeenCalledWith("context", expect.any(Function));
		expect(runtime.pi.on).not.toHaveBeenCalledWith(
			"turn_end",
			expect.any(Function),
		);

		await runtime.eventHandler("context")(
			{ messages: safeBoundaryMessages() },
			ctx,
		);
		await flushMicrotasks();

		expect(ctx.ui.notify).toHaveBeenCalledWith(
			"Pi Session Continuity: context threshold reached; preparing Continuity Handoff.",
			"info",
		);
		expect(ctx.compact).toHaveBeenCalledTimes(1);
		expect(runtime.pi.sendUserMessage).toHaveBeenCalledWith(
			expect.stringContaining("# Continuity Brief"),
			expect.objectContaining({ deliverAs: "followUp" }),
		);
	});

	it("does not trigger from context unless the assistant/tool-result batch is complete", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();
		const incomplete = safeBoundaryMessages().slice(0, 2);

		await runtime.eventHandler("context")({ messages: incomplete }, ctx);

		expect(ctx.compact).not.toHaveBeenCalled();
		expect(runtime.pi.sendUserMessage).not.toHaveBeenCalled();
	});

	it("suppresses repeated usage-unavailable warnings for the same session/config", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx({ getContextUsage: undefined as never });

		await runtime.eventHandler("context")(
			{ messages: safeBoundaryMessages() },
			ctx,
		);
		await runtime.eventHandler("context")(
			{ messages: safeBoundaryMessages() },
			ctx,
		);

		expect(
			ctx.ui.notify.mock.calls.filter(([message]) =>
				String(message).includes("context usage is unavailable"),
			),
		).toHaveLength(1);
	});

	it("guards duplicate extension loads on the same runtime event bus", () => {
		const events = {};
		const firstRuntime = fakePi(events);
		const duplicateRuntime = fakePi(events);

		sessionContinuityExtension(firstRuntime.pi);
		sessionContinuityExtension(duplicateRuntime.pi);

		expect(firstRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
		expect(duplicateRuntime.pi.registerCommand).not.toHaveBeenCalled();
		expect(firstRuntime.pi.on).toHaveBeenCalledWith(
			"session_shutdown",
			expect.any(Function),
		);
	});

	it("allows independent runtime event buses to register in the same process", () => {
		const firstRuntime = fakePi({});
		const secondRuntime = fakePi({});

		sessionContinuityExtension(firstRuntime.pi);
		sessionContinuityExtension(secondRuntime.pi);

		expect(firstRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
		expect(secondRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
	});

	it("allows the same runtime event bus to register again after shutdown", async () => {
		const events = {};
		const firstRuntime = fakePi(events);
		const reloadedRuntime = fakePi(events);

		sessionContinuityExtension(firstRuntime.pi);
		await firstRuntime.eventHandler("session_shutdown")({}, fakeCtx());
		sessionContinuityExtension(reloadedRuntime.pi);

		expect(firstRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
		expect(reloadedRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
	});
});
