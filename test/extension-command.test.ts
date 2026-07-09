import { mkdtemp, rm } from "node:fs/promises";
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

function fakePi(): {
	pi: ExtensionAPI;
	sendMessage: ReturnType<typeof vi.fn>;
	commandHandler: () => CommandHandler;
} {
	let handler: CommandHandler | undefined;
	const sendMessage = vi.fn();
	const pi = {
		registerMessageRenderer: vi.fn(),
		registerCommand: vi.fn(
			(_name: string, options: { handler: CommandHandler }) => {
				handler = options.handler;
			},
		),
		on: vi.fn(),
		sendMessage,
		sendUserMessage: vi.fn(),
	} as unknown as ExtensionAPI;
	return {
		pi,
		sendMessage,
		commandHandler: () => {
			if (!handler) throw new Error("continuity command was not registered");
			return handler;
		},
	};
}

function fakeCtx(): ExtensionContext & {
	ui: ExtensionContext["ui"] & {
		select: ReturnType<typeof vi.fn>;
		setStatus: ReturnType<typeof vi.fn>;
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
			select: vi.fn(async () => "Done"),
		} as unknown as ExtensionContext["ui"] & {
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
		},
		sessionManager: {
			getSessionId: () => "session-a",
		} as unknown as ExtensionContext["sessionManager"],
	} as ExtensionContext & {
		ui: ExtensionContext["ui"] & {
			select: ReturnType<typeof vi.fn>;
			setStatus: ReturnType<typeof vi.fn>;
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
	it("opens settings when /continuity is invoked without arguments", async () => {
		const runtime = fakePi();
		sessionContinuityExtension(runtime.pi);
		const ctx = fakeCtx();

		await runtime.commandHandler()("", ctx);

		expect(ctx.ui.select).toHaveBeenCalledWith(
			"Pi Session Continuity settings",
			expect.arrayContaining(["Done"]),
		);
		expect(runtime.sendMessage).not.toHaveBeenCalled();
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
});
