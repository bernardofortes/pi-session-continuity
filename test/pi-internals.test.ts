import { describe, expect, it, vi, beforeEach } from "vitest";
import { estimateContextTokensFromMessages } from "../src/pi-internals.js";

const mockEstimate = vi.hoisted(() => vi.fn());

vi.mock("node:module", () => ({
	createRequire: () => ({
		resolve: vi.fn(() => "/fake/pi-coding-agent/index.js"),
	}),
}));

vi.mock("node:url", () => ({
	pathToFileURL: (p: string) => ({ href: `file://${p}` }),
}));

vi.mock("file:///fake/pi-coding-agent/core/compaction/compaction.js", () => ({
	estimateContextTokens: mockEstimate,
}));

describe("estimateContextTokensFromMessages", () => {
	beforeEach(() => {
		mockEstimate.mockReset();
	});

	it("returns the estimate from Pi internals when available", async () => {
		mockEstimate.mockReturnValue({
			tokens: 204000,
			usageTokens: 200000,
			trailingTokens: 4000,
			lastUsageIndex: 5,
		});

		const result = await estimateContextTokensFromMessages([
			{ role: "user", content: "test" },
		]);

		expect(result).toEqual({
			tokens: 204000,
			usageTokens: 200000,
			trailingTokens: 4000,
			lastUsageIndex: 5,
		});
		expect(mockEstimate).toHaveBeenCalledTimes(1);
	});

	it("returns null when Pi internals cannot be loaded", async () => {
		mockEstimate.mockImplementation(() => {
			throw new Error("module not found");
		});

		const result = await estimateContextTokensFromMessages([]);

		expect(result).toBeNull();
	});
});
