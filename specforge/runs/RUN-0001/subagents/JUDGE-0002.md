## Review

- Correct: post-queue archive/update failures are no longer routed through the pre-queue failure path. `src/handoff.ts:282-286` reads the pending artifact from disk, builds the resume prompt, and queues it before the nested post-queue block; `src/handoff.ts:305-311` now returns `ok: true`, does not write a failed artifact, and warns that the prompt was queued. Coverage exists in `test/handoff.test.ts:155-174`.
- Correct: the injected/archive transition is now present in source. After queueing the prompt, `src/handoff.ts:290-291` calls `markBriefInjected()` then `archiveBrief()`, and the artifact helpers persist `status: "injected"` before replacing it with `status: "archived"` for the archive move (`src/artifact.ts:257-270`).
- Correct: stale pending status and existing on-disk lock suppression were added. `src/handoff.ts:210-223` scans same-session lock sentinels, `src/handoff.ts:246-250` skips when a fresh lock is found, and `src/status.ts:15-39` reports stale pending artifacts with matching lock paths. Tests cover a pre-existing fresh lock (`test/handoff.test.ts:190-203`) and stale pending status with lock detail (`test/status.test.ts:20-38`).
- Correct: the directive-looking phrase blacklist is gone from `validateBrief()`: current validation checks frontmatter/session/status and mandatory headings only (`src/artifact.ts:187-218`), while the synthesis prompt carries the authority-boundary instruction (`src/handoff.ts:79-85`). The new allowance test is `test/artifact.test.ts:68-70`.
- Correct: `.pi-subagents/` is ignored in `.gitignore:1-6`.
- Blocker: none found in the repaired areas reviewed.
- Major: `src/handoff.ts:296-311` still couples compaction setup failures to artifact archive/update failure handling. If `ctx.compact()` throws synchronously after `archiveBrief()` succeeds, the catch rewrites `state.lastArtifactPath` to the old pending path (`src/handoff.ts:307-309`) and returns no `archivePath` (`src/handoff.ts:311`) even though the archive artifact already exists. This violates the spec path-reporting rule that after a successful archive move status reports the final archive path (`docs/product-spec.md:153-160`). Add a separate compaction `try/catch` after the archive result is recorded/returned so compaction hygiene failure cannot misreport the artifact transition.
- Major: on-disk duplicate suppression is not atomic across concurrent extension/process instances. The implementation first scans for any existing fresh lock (`src/handoff.ts:246`) and then creates a unique per-event lock (`src/handoff.ts:253-264`). Two instances that both pass the pre-scan before either lock is visible can each write a different `<eventId>.json` lock and proceed, so the product's single-flight duplicate-suppression expectation remains vulnerable under concurrency (`docs/product-spec.md:512`, `docs/product-spec.md:524`). The current test only covers a lock that already exists before the handoff starts (`test/handoff.test.ts:190-203`).
- Major: required directive-promotion rejection coverage is still absent. The product spec requires unit coverage that rejects briefs promoting directive-looking transcript/file/tool content above active authority (`docs/product-spec.md:503-516`). Current `validateBrief()` has no such check (`src/artifact.ts:187-218`), and the only directive-looking test verifies allowed ordinary evidence (`test/artifact.test.ts:68-70`). If semantic rejection is deferred, document/waive it; otherwise add a concrete contract and test.
- Minor: the post-queue archive-failure test name says it verifies the extension does not claim no prompt was queued, but the test does not inspect notifications because `fakeCtx()` keeps the notification array private (`test/handoff.test.ts:17-25`) and the assertions only check `sent`, `ok`, `failedPath`, and `error` (`test/handoff.test.ts:170-173`). Source currently emits the right warning (`src/handoff.ts:310`), but this regression is not directly locked by the test.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Returned concrete blocker/major/minor findings with file paths and line numbers for src/handoff.ts, src/artifact.ts, src/status.ts, test files, .gitignore, and docs/product-spec.md."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npm test",
      "result": "passed",
      "summary": "Vitest passed: 4 test files, 19 tests."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "tsc --noEmit completed with no diagnostics."
    },
    {
      "command": "npm pack --dry-run",
      "result": "passed",
      "summary": "Dry-run package produced pi-session-continuity-0.1.0.tgz with 11 files, 20.8 kB package size."
    },
    {
      "command": "git diff --cached --name-only && git status --short",
      "result": "passed",
      "summary": "No staged files listed; worktree contains untracked package skeleton files."
    }
  ],
  "validationOutput": [
    "npm test: 4 passed test files, 19 passed tests.",
    "npm run typecheck: passed with no output beyond the script header.",
    "npm pack --dry-run: total files 11; package size 20.8 kB; tarball pi-session-continuity-0.1.0.tgz."
  ],
  "residualRisks": [
    "Synchronous ctx.compact() failure after archive success can still misreport lastArtifactPath as the pending path and omit archivePath.",
    "On-disk lock duplicate suppression is pre-scan based, not atomic for concurrent cross-process starts.",
    "No implementation/test currently rejects directive-looking content that is promoted above active instruction authority; only allowed evidence is covered.",
    "Pi clean install/smoke from a GitHub ref was not run in this review."
  ],
  "noStagedFiles": true,
  "diffSummary": "Review-only delta inspection; no source changes made. Repository remains a mostly untracked package skeleton plus implementation/tests/docs, with .pi-subagents ignored.",
  "reviewFindings": [
    "no blocker: repaired areas no longer show a critical invariant violation for the normal disk-backed queue/archive path.",
    "major: src/handoff.ts:296-311 - synchronous compaction failure after archive success is caught as artifact archive/update failure and resets lastArtifactPath to the pending path.",
    "major: src/handoff.ts:246-264 - on-disk duplicate suppression scans then writes a unique per-event lock, leaving a concurrent cross-process race not covered by tests.",
    "major: src/artifact.ts:187-218 and test/artifact.test.ts:68-70 - required rejection of directive-looking content promoted above active authority is not implemented or tested.",
    "minor: test/handoff.test.ts:155-174 - post-queue failure test does not assert the user-facing notification despite its claim."
  ],
  "manualNotes": "Findings were written to the required subagent output path. No repository source edits were performed."
}
```
