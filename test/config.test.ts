import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	deriveKeepRecentTokens,
	detectNativeAutoCompaction,
	loadConfigFromDisk,
	shouldTriggerHandoff,
	validateConfig,
	writeConfigToDisk,
} from "../src/config.js";

const path = "/workspace/.pi/session-continuity.json";

describe("config validation", () => {
	it("accepts defaults and valid percentages", () => {
		const result = validateConfig({}, path);
		expect(result.errors).toEqual([]);
		expect(result.config?.triggerAtPercent).toBe(70);
		expect(result.config?.keepRecentPercent).toBe(20);
		expect(result.config?.synthesisEffort).toBe("medium");
	});

	it("rejects invalid synthesis effort", () => {
		const result = validateConfig({ synthesisEffort: "extreme" }, path);
		expect(result.errors).toContain(
			'synthesisEffort must be one of "inherit", "minimal", "low", "medium", "high", or "xhigh"',
		);
	});

	it("rejects invalid percentage values", () => {
		expect(
			validateConfig({ triggerAtPercent: 0, keepRecentPercent: 20 }, path)
				.errors,
		).toContain("triggerAtPercent must be positive and below 100");
		expect(
			validateConfig({ triggerAtPercent: 75, keepRecentPercent: 100 }, path)
				.errors,
		).toContain("keepRecentPercent must be positive and below 100");
	});

	it("rejects keepRecentPercent at or above triggerAtPercent", () => {
		const result = validateConfig(
			{ triggerAtPercent: 75, keepRecentPercent: 75 },
			path,
		);
		expect(result.errors).toContain(
			"keepRecentPercent must be lower than triggerAtPercent",
		);
	});

	it("calculates trigger percentage across different context windows", () => {
		expect(shouldTriggerHandoff(89_600, 128_000, 70)).toBe(true);
		expect(shouldTriggerHandoff(699_999, 1_000_000, 70)).toBe(false);
		expect(shouldTriggerHandoff(700_000, 1_000_000, 70)).toBe(true);
	});

	it("derives keep recent tokens from active model context window", () => {
		expect(deriveKeepRecentTokens(128_000, 20)).toBe(25_600);
		expect(deriveKeepRecentTokens(1_000_000, 20)).toBe(200_000);
	});

	it("resolves relative artifact directories under the config directory", async () => {
		const dir = await mkdtemp(join(tmpdir(), "psc-config-"));
		try {
			const config = await loadConfigFromDisk(dir, ".pi", true);
			expect(config.artifactDirectoryPath).toBe(
				join(dir, ".pi", "session-continuity"),
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes project-local config changes for the settings menu", async () => {
		const dir = await mkdtemp(join(tmpdir(), "psc-config-"));
		try {
			const configPath = join(dir, ".pi", "session-continuity.json");
			await writeConfigToDisk(configPath, {
				enabled: true,
				triggerAtPercent: 75,
				keepRecentPercent: 20,
				synthesisModel: "inherit",
				synthesisEffort: "high",
				artifactDirectory: "session-continuity",
			});
			const config = await loadConfigFromDisk(dir, ".pi", true);
			expect(config.valid).toBe(true);
			expect(config.triggerAtPercent).toBe(75);
			expect(config.keepRecentPercent).toBe(20);
			expect(config.synthesisEffort).toBe("high");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects invalid settings-menu writes before corrupting config", async () => {
		const dir = await mkdtemp(join(tmpdir(), "psc-config-"));
		try {
			const configPath = join(dir, ".pi", "session-continuity.json");
			await expect(
				writeConfigToDisk(configPath, {
					enabled: true,
					triggerAtPercent: 20,
					keepRecentPercent: 20,
					synthesisModel: "inherit",
					synthesisEffort: "medium",
					artifactDirectory: "session-continuity",
				}),
			).rejects.toThrow(
				"keepRecentPercent must be lower than triggerAtPercent",
			);
			await expect(
				writeConfigToDisk(configPath, {
					enabled: true,
					triggerAtPercent: 75,
					keepRecentPercent: 20,
					synthesisModel: "inherit",
					synthesisEffort: "medium",
					artifactDirectory: "../outside",
				}),
			).rejects.toThrow("artifactDirectory must resolve under");
			const config = await loadConfigFromDisk(dir, ".pi", true);
			expect(config.valid).toBe(true);
			expect(config.triggerAtPercent).toBe(70);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects relative artifact directories that escape the config directory", async () => {
		const dir = await mkdtemp(join(tmpdir(), "psc-config-"));
		try {
			await mkdir(join(dir, ".pi"), { recursive: true });
			await writeFile(
				join(dir, ".pi", "session-continuity.json"),
				JSON.stringify({ artifactDirectory: "../outside" }),
				"utf8",
			);
			const config = await loadConfigFromDisk(dir, ".pi", true);
			expect(config.valid).toBe(false);
			expect(config.enabled).toBe(false);
			expect(config.errors.join("\n")).toContain(
				"artifactDirectory must resolve under",
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("detects native Pi auto-compaction from merged settings", async () => {
		const dir = await mkdtemp(join(tmpdir(), "psc-config-"));
		const agentDir = await mkdtemp(join(tmpdir(), "psc-agent-"));
		try {
			await writeFile(
				join(agentDir, "settings.json"),
				JSON.stringify({ compaction: { enabled: true } }),
				"utf8",
			);
			expect(detectNativeAutoCompaction(dir, true, agentDir).enabled).toBe(
				true,
			);

			await mkdir(join(dir, ".pi"), { recursive: true });
			await writeFile(
				join(dir, ".pi", "settings.json"),
				JSON.stringify({ compaction: { enabled: false } }),
				"utf8",
			);
			expect(detectNativeAutoCompaction(dir, true, agentDir).enabled).toBe(
				false,
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
			await rm(agentDir, { recursive: true, force: true });
		}
	});
});
