import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const requiredSmokeAssertions = [
	"manual-checkpoint-writes-artifact",
	"resume-uses-disk-artifact",
	"required-identity-present",
	"reload-stale-is-inert",
	"duplicate-trigger-single-flight",
	"threshold-percent-model-change",
	"synthesis-failure-no-prompt",
	"write-failure-no-prompt",
	"cross-session-rejected",
];

const requiredReadmePhrases = [
	"pi install npm:pi-session-continuity",
	"pi install git:github.com/bernardofortes/pi-session-continuity@v0.1.0",
	"/continuity status",
	"/continuity checkpoint",
	"/continuity settings",
	"<workspace>/<CONFIG_DIR_NAME>/session-continuity.json",
	"Durable Continuity Brief first.",
	"Resume prompt is injected from the disk artifact.",
	"Compaction is token hygiene, not the source of continuity.",
	"<artifactDirectory>/<sessionId>/pending/<eventId>.md",
	"Continuity Briefs are local files",
	"v0.1.0 does not guarantee secret redaction",
	"Invalid config",
	"Synthesis failure",
	"Write failure",
	"Stale pending artifact",
	"Untrusted project",
	"pi update --extension",
	"pi remove npm:pi-session-continuity",
	"pi remove git:github.com/bernardofortes/pi-session-continuity",
	"Compatibility",
	"npm run smoke:manual",
	"separate explicit human approval",
];

describe("package smoke contract", () => {
	it("ships the manual smoke runner referenced by package scripts", async () => {
		const packageJson = JSON.parse(await readFile("package.json", "utf8"));
		expect(packageJson.scripts["smoke:manual"]).toBe(
			"bash scripts/smoke/manual-checks.sh",
		);
		expect(packageJson.files).toContain("scripts");
		const mode = (await stat("scripts/smoke/manual-checks.sh")).mode;
		expect(mode & 0o111).not.toBe(0);
	});

	it("represents every required manual Pi smoke assertion with pass/fail outcomes", async () => {
		const script = await readFile("scripts/smoke/manual-checks.sh", "utf8");
		for (const assertion of requiredSmokeAssertions) {
			expect(script).toContain(assertion);
		}
		expect(script).toContain("PASS/FAIL");
		expect(script).toContain("result: PASS|FAIL");
		expect(script).toContain("Pi version/commit");
		expect(script).toContain("Artifact directory");
	});

	it("keeps the product spec package files contract aligned with the smoke runner", async () => {
		const spec = await readFile("docs/product-spec.md", "utf8");
		expect(spec).toContain(
			'"files": ["extensions", "src", "docs", "scripts", "README.md", "LICENSE", "CHANGELOG.md"]',
		);
	});

	it("keeps public README collateral complete for v0.1.0 release readiness", async () => {
		const readme = await readFile("README.md", "utf8");
		for (const phrase of requiredReadmePhrases) {
			expect(readme).toContain(phrase);
		}
	});

	it("keeps changelog v0.1.0 notes and external release approval explicit", async () => {
		const changelog = await readFile("CHANGELOG.md", "utf8");
		expect(changelog).toContain("## 0.1.0");
		expect(changelog).toContain("manual smoke checklist");
		expect(changelog).toContain("GitHub install smoke");
		expect(changelog).toContain("explicit human approval");
	});
});
