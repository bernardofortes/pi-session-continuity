## Review

Verdict: **PASS**

### Correct

- `src/trigger.ts:17-30` implements the automatic trigger decision helper with explicit skips for untrusted, invalid, disabled, missing usage, unknown tokens/window, and below-threshold states before returning `threshold-reached`.
- `src/config.ts:247-260` is the formula used by the helper and matches `docs/product-spec.md` section 13: `tokens / contextWindow >= triggerAtPercent / 100`.
- `test/trigger.test.ts:21-36` covers the requested skip states and proves 65% threshold behavior at both 128k (`83_200 / 128_000`) and 1M (`650_000 / 1_000_000`) context windows, including just-below-threshold cases.
- `extensions/session-continuity/index.ts:66-91` runs the automatic check on `turn_end`, passes `ctx.getContextUsage()` into `decideAutomaticTrigger`, returns without handoff for all negative decisions, and calls `runContinuityHandoff(..., { reason: "threshold", requestCompaction: true })` only after `decision.shouldRun` is true.
- `extensions/session-continuity/index.ts:124-146` keeps manual `/continuity checkpoint` on `{ reason: "manual", requestCompaction: false }`, so `requestCompaction: true` is limited to automatic threshold handoffs.
- No runtime campaign/loop/episode terms were found in `src`, `extensions`, or `test` by grep inspection.
- Evidence logs satisfy the section 15 quality gates: `specforge/runs/RUN-0005/commands/CMD-0002.log` shows `npm test` passed with 33 tests; `CMD-0003.log` shows `npm run typecheck` completed with no TypeScript errors; `CMD-0004.log` shows `npm pack --dry-run` completed and listed the package tarball contents.
- I found no external mutation behavior in the reviewed implementation; the reviewed changes use local Pi extension APIs and local validation only.

### Fixed

- None. Review-only task; no source edits were made.

### Blockers

- None.

### Majors

- None.

### Minors

- None.

### Residual risks

- `turn_end` wiring is verified by source inspection (`extensions/session-continuity/index.ts:66-91`), not by a dedicated extension-event unit test. Existing unit coverage directly exercises the extracted decision helper.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete review findings cite src/trigger.ts:17-30, src/config.ts:247-260, extensions/session-continuity/index.ts:66-91 and 124-146, test/trigger.test.ts:21-36, plus CMD-0002..0004 validation logs."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff -- src/trigger.ts extensions/session-continuity/index.ts test/trigger.test.ts && git status --short",
      "result": "passed",
      "summary": "No tracked diff was available in this untracked worktree snapshot; status showed untracked project files and no staged files."
    },
    {
      "command": "nl -ba src/trigger.ts; nl -ba extensions/session-continuity/index.ts; nl -ba test/trigger.test.ts",
      "result": "passed",
      "summary": "Collected line-numbered source evidence for review citations."
    },
    {
      "command": "grep -RIn \"campaign\\|loop\\|episode\" src extensions test",
      "result": "exit 1 expected",
      "summary": "No forbidden runtime campaign/loop/episode terms were found; grep exits 1 on no matches."
    }
  ],
  "validationOutput": [
    "CMD-0002.log: npm test passed; 5 test files, 33 tests passed, including test/trigger.test.ts.",
    "CMD-0003.log: npm run typecheck completed with no reported errors.",
    "CMD-0004.log: npm pack --dry-run completed and listed pi-session-continuity-0.1.0.tgz contents."
  ],
  "residualRisks": [
    "turn_end integration verified by source inspection rather than a dedicated event-handler unit test"
  ],
  "noStagedFiles": true,
  "diffSummary": "Review-only: inspected automatic threshold helper, extension turn_end wiring, trigger tests, and SpecForge validation logs; no source edits applied by reviewer.",
  "reviewFindings": [
    "no blockers",
    "no majors",
    "no minors"
  ],
  "manualNotes": "PASS. Output artifact was written as required; source files were not edited."
}
```
