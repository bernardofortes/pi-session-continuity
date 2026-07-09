import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	findStalePendingArtifacts,
	footerStatusForMessage,
	formatSettings,
	formatStatus,
	notificationLevelForMessage,
} from "../src/status.js";
import { loadConfigFromDisk } from "../src/config.js";
import { createHandoffState } from "../src/handoff.js";

let dir: string;

function expectStatusPanelFields(status: string): void {
	expect(status).toContain("Status");
	expect(status).toContain("- Mode:");
	expect(status).toContain("- Trigger threshold:");
	expect(status).toContain("- Keep after handoff:");
	expect(status).toContain("- Synthesis model:");
	expect(status).toContain("- Synthesis effort:");
	expect(status).toContain("- Artifacts:");
	expect(status).toContain("- Active operation:");
	expect(status).toContain("- Last checkpoint:");
	expect(status).toContain("- Last artifact:");
	expect(status).toContain("- Last failure:");
	expect(status).not.toContain("Diagnostics");
	expect(status).not.toContain("triggerAtPercent:");
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "psc-status-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("status and stale pending artifacts", () => {
	it("formats untrusted and invalid status with concrete config paths", async () => {
		const untrusted = await loadConfigFromDisk(dir, ".pi", false);
		const untrustedStatus = formatStatus(untrusted, createHandoffState());
		expect(untrustedStatus).toContain("project is not trusted");
		expect(untrustedStatus).toContain(
			"automatic behavior disabled because project is not trusted",
		);
		expectStatusPanelFields(untrustedStatus);

		await mkdir(join(dir, ".pi"), { recursive: true });
		await writeFile(
			join(dir, ".pi", "session-continuity.json"),
			JSON.stringify({ triggerAtPercent: 65, keepRecentPercent: 65 }),
			"utf8",
		);
		const invalid = await loadConfigFromDisk(dir, ".pi", true);
		const invalidStatus = formatStatus(invalid, createHandoffState());
		expect(invalidStatus).toContain(
			`Pi Session Continuity disabled: invalid configuration in ${invalid.configPath}.`,
		);
		expectStatusPanelFields(invalidStatus);
	});

	it("formats enabled and disabled status with the complete field set", async () => {
		const enabled = await loadConfigFromDisk(dir, ".pi", true);
		const enabledStatus = formatStatus(enabled, createHandoffState());
		expect(enabledStatus).toContain(
			"Pi Session Continuity: enabled · trigger 75% · keep 20%.",
		);
		expect(enabledStatus).toContain(
			"Trigger threshold: 75% of the active context window",
		);
		expect(enabledStatus).toContain("Keep after handoff: 20%");
		expectStatusPanelFields(enabledStatus);

		await mkdir(join(dir, ".pi"), { recursive: true });
		await writeFile(
			join(dir, ".pi", "session-continuity.json"),
			JSON.stringify({ enabled: false }),
			"utf8",
		);
		const disabled = await loadConfigFromDisk(dir, ".pi", true);
		const disabledStatus = formatStatus(disabled, createHandoffState());
		expect(disabledStatus).toContain(
			"Pi Session Continuity: disabled by configuration.",
		);
		expect(disabledStatus).toContain("Trigger threshold: 75%");
		expect(disabledStatus).toContain("Keep after handoff: 20%");
		expectStatusPanelFields(disabledStatus);
	});

	it("formats settings with all public config fields and resolved paths", async () => {
		await mkdir(join(dir, ".pi"), { recursive: true });
		await writeFile(
			join(dir, ".pi", "session-continuity.json"),
			JSON.stringify({
				enabled: false,
				triggerAtPercent: 70,
				keepRecentPercent: 20,
				synthesisModel: "provider/model",
				synthesisEffort: "high",
				artifactDirectory: "custom-artifacts",
			}),
			"utf8",
		);
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const settings = formatSettings(config);
		expect(settings).toContain("Pi Session Continuity: settings");
		expect(settings).toContain("Trigger threshold: 70%");
		expect(settings).toContain("Keep after handoff: 20%");
		expect(settings).toContain(`Config path: ${config.configPath}`);
		expect(settings).toContain("Enabled: off");
		expect(settings).toContain("Synthesis model: provider/model");
		expect(settings).toContain("Synthesis effort: high");
		expect(settings).toContain("Artifact directory: custom-artifacts");
		expect(settings).toContain(
			`Resolved artifacts: ${join(dir, ".pi", "custom-artifacts")}`,
		);
		expect(settings).toContain("Disabled reason: none");
		expect(settings).not.toContain("Diagnostics");
		expect(notificationLevelForMessage(settings)).toBe("info");
	});

	it("only uses warning severity for unsafe status headlines", () => {
		expect(
			notificationLevelForMessage(
				"Pi Session Continuity: settings\ndisabled reason: none",
			),
		).toBe("info");
		expect(
			notificationLevelForMessage(
				"Pi Session Continuity disabled: invalid configuration in /tmp/config.json.",
			),
		).toBe("warning");
	});

	it("keeps footer status compact instead of repeating detailed panels", () => {
		expect(
			footerStatusForMessage(
				"Pi Session Continuity: enabled · trigger 75% · keep 20%.",
			),
		).toBe("Session Continuation @ 75%");
		expect(
			footerStatusForMessage("Pi Session Continuity: settings\nConfig"),
		).toBe("PSC settings");
		expect(
			footerStatusForMessage(
				"Pi Session Continuity disabled: invalid configuration in /tmp/config.json.",
			),
		).toBe("PSC disabled");
	});

	it("reports same-session stale pending artifacts with lock details while leaving them inert", async () => {
		const config = await loadConfigFromDisk(dir, ".pi", true);
		const pendingDir = join(
			config.artifactDirectoryPath,
			"session-a",
			"pending",
		);
		const lockDir = join(config.artifactDirectoryPath, "session-a", "lock");
		await mkdir(pendingDir, { recursive: true });
		await mkdir(lockDir, { recursive: true });
		await writeFile(join(pendingDir, "event-1.md"), "stale", "utf8");
		await writeFile(
			join(lockDir, "event-1.json"),
			JSON.stringify({
				eventId: "event-1",
				createdAt: new Date().toISOString(),
			}),
			"utf8",
		);

		const stale = await findStalePendingArtifacts(
			config.artifactDirectoryPath,
			"session-a",
		);
		expect(stale).toHaveLength(1);
		expect(stale[0].path).toContain("pending/event-1.md");
		expect(stale[0].lockPath).toContain("lock/event-1.json");

		const status = formatStatus(
			config,
			createHandoffState(),
			`${stale[0].path} (lock: ${stale[0].lockPath})`,
		);
		expect(status).toContain("Stale pending artifact:");
		expect(status).toContain("pending/event-1.md");
		expect(status).toContain("lock/event-1.json");
	});
});
