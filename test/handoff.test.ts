import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	ARCHIVE_RETENTION_LIMIT,
	MANDATORY_HEADINGS,
} from "../src/constants.js";
import { buildResumePrompt } from "../src/artifact.js";
import { loadConfigFromDisk } from "../src/config.js";
import { createHandoffState, runContinuityHandoff } from "../src/handoff.js";

let dir: string;

function body(): string {
	return MANDATORY_HEADINGS.map((heading) => `${heading}\nNone known.`).join(
		"\n\n",
	);
}

async function waitFor(check: () => void): Promise<void> {
	const started = Date.now();
	let lastError: unknown;
	while (Date.now() - started < 1000) {
		try {
			check();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
	throw lastError;
}

function fakeCtx(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
	const notifications: string[] = [];
	return {
		cwd: dir,
		mode: "tui",
		hasUI: true,
		ui: {
			notifications,
			notify: (message: string) => notifications.push(message),
			setStatus: vi.fn(),
			select: vi.fn(),
			confirm: vi.fn(),
			input: vi.fn(),
			onTerminalInput: vi.fn(),
			setWorkingMessage: vi.fn(),
			setWorkingVisible: vi.fn(),
			setWorkingIndicator: vi.fn(),
			setHiddenThinkingLabel: vi.fn(),
			setWidget: vi.fn(),
			setFooter: vi.fn(),
			setHeader: vi.fn(),
			setTitle: vi.fn(),
			custom: vi.fn(),
			pasteToEditor: vi.fn(),
			setEditorText: vi.fn(),
			getEditorText: vi.fn(() => ""),
			editor: vi.fn(),
			addAutocompleteProvider: vi.fn(),
			setEditorComponent: vi.fn(),
			getEditorComponent: vi.fn(),
			theme: {} as never,
			getAllThemes: vi.fn(() => []),
			getTheme: vi.fn(),
			setTheme: vi.fn(() => ({ success: true })),
			getToolsExpanded: vi.fn(() => false),
			setToolsExpanded: vi.fn(),
		},
		sessionManager: {
			getSessionId: () => "session-a",
			getSessionFile: () => join(dir, "session.jsonl"),
			getLeafId: () => "leaf-1",
			getBranch: () => [],
			getEntries: () => [],
			getCwd: () => dir,
			getSessionDir: () => dir,
			getLeafEntry: () => undefined,
			getEntry: () => undefined,
			getLabel: () => undefined,
			getHeader: () => null,
			getTree: () => [],
			getSessionName: () => undefined,
		},
		modelRegistry: {} as never,
		model: { provider: "test", id: "model", contextWindow: 1000 } as never,
		isIdle: () => false,
		isProjectTrusted: () => true,
		signal: undefined,
		abort: vi.fn(),
		shutdown: vi.fn(),
		hasPendingMessages: () => false,
		getContextUsage: () => ({ tokens: 750, contextWindow: 1000, percent: 75 }),
		compact: vi.fn(),
		getSystemPrompt: () => "active system prompt",
		...overrides,
	} as ExtensionContext & { ui: { notifications: string[] } };
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "psc-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("continuity handoff", () => {
	it("writes a valid artifact, queues prompt from the exact disk artifact, and archives", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: Array<{ text: string; options?: unknown }> = [];
		let diskBriefAtQueue = "";
		const pi = {
			sendUserMessage: (text: string, options?: unknown) => {
				const pendingDir = join(
					config.artifactDirectoryPath,
					"session-a",
					"pending",
				);
				const pendingName = readdirSync(pendingDir).find((name) =>
					name.endsWith(".md"),
				);
				diskBriefAtQueue = readFileSync(
					join(pendingDir, pendingName!),
					"utf8",
				).trim();
				sent.push({ text, options });
			},
		};
		const result = await runContinuityHandoff(
			pi,
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => body(),
			},
		);

		expect(result.ok).toBe(true);
		expect(result.archivePath).toBeTruthy();
		expect(result.pendingPath).toBeTruthy();
		expect(sent).toHaveLength(1);
		expect(sent[0].options).toEqual({ deliverAs: "followUp" });
		await expect(stat(result.pendingPath!)).rejects.toThrow();
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual([]);
		const archived = await readFile(result.archivePath!, "utf8");
		const queuedBrief = sent[0].text.split(
			"\n\nYou are continuing after a Pi Session Continuity handoff.",
		)[0];
		expect(queuedBrief).toBe(diskBriefAtQueue);
		expect(queuedBrief).toContain('status: "pending"');
		expect(archived).toContain('status: "archived"');
		expect(queuedBrief).toContain("# Continuity Brief");
	});

	it("keeps only the newest archived briefs for the same session", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const archiveDir = join(
			config.artifactDirectoryPath,
			"session-a",
			"archive",
		);
		await mkdir(archiveDir, { recursive: true });
		for (let index = 0; index < 12; index += 1) {
			await writeFile(
				join(
					archiveDir,
					`2000-01-01T00-00-${String(index).padStart(2, "0")}-000Z-old-${index}.md`,
				),
				"old archive",
				"utf8",
			);
		}

		const result = await runContinuityHandoff(
			{ sendUserMessage: vi.fn() },
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => body(),
			},
		);

		expect(result.ok).toBe(true);
		expect(result.archivePath).toBeTruthy();
		const archives = readdirSync(archiveDir).filter((name) =>
			name.endsWith(".md"),
		);
		expect(archives).toHaveLength(ARCHIVE_RETENTION_LIMIT);
		expect(archives).toContain(result.archivePath!.split("/").at(-1));
		expect(archives).not.toContain("2000-01-01T00-00-00-000Z-old-0.md");
		expect(archives).not.toContain("2000-01-01T00-00-01-000Z-old-1.md");
		expect(archives).not.toContain("2000-01-01T00-00-02-000Z-old-2.md");
	});

	it("queues no prompt when synthesis fails and writes failed postmortem when possible", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: string[] = [];
		const pi = { sendUserMessage: (text: string) => sent.push(text) };
		const result = await runContinuityHandoff(
			pi,
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => {
					throw new Error("boom");
				},
			},
		);

		expect(result.ok).toBe(false);
		expect(sent).toEqual([]);
		expect(result.failedPath).toBeTruthy();
		const failed = await readFile(result.failedPath!, "utf8");
		expect(failed).toContain('status: "failed"');
		expect(failed).toContain("No resume prompt was queued.");
	});

	it("records an automatic failure cooldown when threshold synthesis fails", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const state = createHandoffState();
		const result = await runContinuityHandoff(
			{ sendUserMessage: vi.fn() },
			fakeCtx(),
			config,
			state,
			{
				reason: "threshold",
				synthesize: async () => {
					throw new Error("empty synthesis");
				},
			},
		);
		expect(result.ok).toBe(false);
		expect(state.lastAutomaticFailureAt).toBeGreaterThan(0);
	});

	it("queues no prompt when synthesized content fails validation", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: string[] = [];
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => "# Continuity Brief\n\n## Task\nIncomplete.",
			},
		);
		expect(result.ok).toBe(false);
		expect(sent).toEqual([]);
		expect(result.failedPath).toBeTruthy();
		const failed = await readFile(result.failedPath!, "utf8");
		expect(failed).toContain('status: "failed"');
		expect(() => buildResumePrompt(failed, "session-a")).toThrow(
			/only pending Continuity Brief artifacts are valid resume input/,
		);
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual([]);
	});

	it("queues no prompt when artifact writing fails", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const blockedArtifactRoot = join(dir, ".pi", "session-continuity");
		await mkdir(join(dir, ".pi"), { recursive: true });
		await writeFile(blockedArtifactRoot, "not a directory", "utf8");
		const sent: string[] = [];
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(false);
		expect(sent).toEqual([]);
		expect(result.error).toMatch(/ENOTDIR|EEXIST|not a directory/);
	});

	it("does not claim no prompt was queued when archive fails after injection", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: string[] = [];
		const pi = {
			sendUserMessage: (text: string) => {
				const archivePath = join(
					config.artifactDirectoryPath,
					"session-a",
					"archive",
				);
				rmSync(archivePath, { recursive: true, force: true });
				writeFileSync(archivePath, "archive blocker", "utf8");
				sent.push(text);
			},
		};
		const ctx = fakeCtx();
		const result = await runContinuityHandoff(
			pi,
			ctx,
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => body(),
			},
		);
		expect(sent).toHaveLength(1);
		expect(result.ok).toBe(true);
		expect(result.failedPath).toBeUndefined();
		expect(result.error).toBeTruthy();
		const notifications = (
			ctx as unknown as { ui: { notifications: string[] } }
		).ui.notifications.join("\n");
		expect(notifications).toContain("resume prompt queued");
		expect(notifications).not.toContain("No resume prompt was queued");
	});

	it("suppresses duplicate handoffs in the same session", async () => {
		const state = createHandoffState();
		state.activeBySession.set("session-a", "event-existing");
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: string[] = [];
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx(),
			config,
			state,
			{
				reason: "threshold",
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.error).toBe("duplicate trigger skipped");
		expect(sent).toEqual([]);
	});

	it("does not queue resume when compaction setup throws after saving artifact", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: string[] = [];
		const state = createHandoffState();
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx({
				isIdle: () => true,
				compact: () => {
					throw new Error("compact boom");
				},
			}),
			config,
			state,
			{
				reason: "threshold",
				requestCompaction: true,
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.pendingPath).toBeTruthy();
		expect(result.archivePath).toBeUndefined();
		expect(sent).toEqual([]);
		expect(state.lastAutomaticFailureAt).toBeGreaterThan(0);
		await expect(stat(result.pendingPath!)).resolves.toBeTruthy();
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual([]);
	});

	it("suppresses duplicate handoffs using a fresh on-disk lock sentinel", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const lockDir = join(config.artifactDirectoryPath, "session-a", "lock");
		await mkdir(lockDir, { recursive: true });
		await writeFile(
			join(lockDir, "event-existing.json"),
			JSON.stringify({
				eventId: "event-existing",
				createdAt: new Date().toISOString(),
			}),
			"utf8",
		);
		const sent: string[] = [];
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "threshold",
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.eventId).toBe("event-existing");
		expect(sent).toEqual([]);
	});

	it("suppresses duplicate handoffs using a fresh active lock directory", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const activeLockPath = join(
			config.artifactDirectoryPath,
			"session-a",
			"lock",
			".active",
		);
		await mkdir(activeLockPath, { recursive: true });
		const sent: string[] = [];
		const result = await runContinuityHandoff(
			{ sendUserMessage: (text: string) => sent.push(text) },
			fakeCtx(),
			config,
			createHandoffState(),
			{
				reason: "threshold",
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.error).toBe("duplicate trigger skipped");
		expect(sent).toEqual([]);
		await expect(stat(activeLockPath)).resolves.toBeTruthy();
	});

	it("uses followUp delivery for disk-backed resume even when idle", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const sent: Array<{ text: string; options?: unknown }> = [];
		const result = await runContinuityHandoff(
			{
				sendUserMessage: (text: string, options?: unknown) =>
					sent.push({ text, options }),
			},
			fakeCtx({ isIdle: () => true }),
			config,
			createHandoffState(),
			{
				reason: "manual",
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(true);
		expect(sent).toHaveLength(1);
		expect(sent[0].options).toEqual({ deliverAs: "followUp" });
	});

	it("defers disk-backed resume until requested compaction completes", async () => {
		let onComplete: (() => void) | undefined;
		const compact = vi.fn(
			(options: { customInstructions?: string; onComplete?: () => void }) => {
				onComplete = options.onComplete;
			},
		);
		const sent: Array<{ text: string; options?: unknown }> = [];
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const result = await runContinuityHandoff(
			{
				sendUserMessage: (text: string, options?: unknown) =>
					sent.push({ text, options }),
			},
			fakeCtx({ isIdle: () => true, compact }),
			config,
			createHandoffState(),
			{
				reason: "threshold",
				requestCompaction: true,
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(true);
		expect(result.pendingPath).toBeTruthy();
		expect(result.archivePath).toBeUndefined();
		expect(sent).toEqual([]);
		expect(compact).toHaveBeenCalledTimes(1);
		expect(compact.mock.calls[0][0].customInstructions).toContain(
			"newest 200 tokens",
		);
		expect(compact.mock.calls[0][0].customInstructions).toContain(
			result.pendingPath,
		);
		await expect(stat(result.pendingPath!)).resolves.toBeTruthy();
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual(expect.arrayContaining([".active"]));

		onComplete?.();
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0].options).toEqual({ deliverAs: "followUp" });
		await expect(stat(result.pendingPath!)).rejects.toThrow();
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "archive")),
		).toHaveLength(1);
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual([]);
	});

	it("does not request compaction when validation fails before queue", async () => {
		const compact = vi.fn();
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const result = await runContinuityHandoff(
			{ sendUserMessage: vi.fn() },
			fakeCtx({ compact }),
			config,
			createHandoffState(),
			{
				reason: "threshold",
				requestCompaction: true,
				synthesize: async () => "# Continuity Brief\n\n## Task\nIncomplete.",
			},
		);
		expect(result.ok).toBe(false);
		expect(compact).not.toHaveBeenCalled();
	});

	it("reports archive update failure after post-compaction resume queue", async () => {
		let onComplete: (() => void) | undefined;
		const compact = vi.fn(
			(options: { customInstructions?: string; onComplete?: () => void }) => {
				onComplete = options.onComplete;
			},
		);
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const state = createHandoffState();
		const sent: string[] = [];
		const pi = {
			sendUserMessage: (text: string) => {
				const archivePath = join(
					config.artifactDirectoryPath,
					"session-a",
					"archive",
				);
				rmSync(archivePath, { recursive: true, force: true });
				writeFileSync(archivePath, "archive blocker", "utf8");
				sent.push(text);
			},
		};
		const result = await runContinuityHandoff(
			pi,
			fakeCtx({ compact }),
			config,
			state,
			{
				reason: "threshold",
				requestCompaction: true,
				synthesize: async () => body(),
			},
		);
		expect(result.ok).toBe(true);
		expect(result.archivePath).toBeUndefined();
		expect(compact).toHaveBeenCalledTimes(1);
		expect(sent).toEqual([]);

		onComplete?.();
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(state.lastFailure).toContain("post-queue artifact update failed");
		expect(
			readdirSync(join(config.artifactDirectoryPath, "session-a", "lock")),
		).toEqual([]);
	});
});
