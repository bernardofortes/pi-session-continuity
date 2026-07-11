import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import sessionContinuityExtension from "../extensions/session-continuity/index.js";

let dir: string;

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

function fakeCtx(): ExtensionContext & {
	ui: ExtensionContext["ui"] & {
		select: ReturnType<typeof vi.fn>;
		setStatus: ReturnType<typeof vi.fn>;
		setWidget: ReturnType<typeof vi.fn>;
	};
} {
	return {
		cwd: dir,
		mode: "tui",
		hasUI: true,
		isProjectTrusted: () => true,
		ui: {
			notify: vi.fn(),
			setStatus: vi.fn(),
			setWidget: vi.fn(),
			select: vi.fn(async () => "Done"),
		} as unknown as ExtensionContext["ui"] & {
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
			setWidget: ReturnType<typeof vi.fn>;
		},
		sessionManager: {
			getSessionId: () => "session-a",
		} as unknown as ExtensionContext["sessionManager"],
	} as ExtensionContext & {
		ui: ExtensionContext["ui"] & {
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
			setWidget: ReturnType<typeof vi.fn>;
		};
	};
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "psc-command-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("continuity command dispatch", () => {
	it("opens a top-level menu when /continuity is invoked without arguments", async () => {
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
			expect.stringContaining("compaction.enabled=false"),
			"warning",
		);
	});

	it("guards duplicate extension loads on the same runtime event bus", () => {
		const events = {};
		const firstRuntime = fakePi(events);
		const duplicateRuntime = fakePi(events);

		sessionContinuityExtension(firstRuntime.pi);
		sessionContinuityExtension(duplicateRuntime.pi);

		expect(firstRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
		expect(duplicateRuntime.pi.registerCommand).not.toHaveBeenCalled();
	});

	it("allows independent runtime event buses to register in the same process", () => {
		const firstRuntime = fakePi({});
		const secondRuntime = fakePi({});

		sessionContinuityExtension(firstRuntime.pi);
		sessionContinuityExtension(secondRuntime.pi);

		expect(firstRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
		expect(secondRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
	});

	it("allows the same runtime event bus to register again after shutdown", () => {
		const events = {};
		const firstRuntime = fakePi(events);
		sessionContinuityExtension(firstRuntime.pi);
		firstRuntime.eventHandler("session_shutdown")({}, fakeCtx());
		const secondRuntime = fakePi(events);
		sessionContinuityExtension(secondRuntime.pi);
		expect(secondRuntime.pi.registerCommand).toHaveBeenCalledTimes(1);
	});
});
