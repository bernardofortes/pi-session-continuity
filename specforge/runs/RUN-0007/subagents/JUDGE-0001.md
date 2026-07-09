## Review

- Correct: `docs/product-spec.md` section 15 requires the nine named manual Pi smoke assertions and pass/fail outcomes (docs/product-spec.md:518-528); `scripts/smoke/manual-checks.sh` is runnable (`#!/usr/bin/env bash`, `set -euo pipefail`) and prints all nine IDs with `PASS/FAIL` result cells plus a `result: PASS|FAIL` transcript template (scripts/smoke/manual-checks.sh:1-42).
- Correct: The public package contract now includes `scripts` in the package files list (docs/product-spec.md:561-569), and `package.json` includes `scripts` in `files` plus `smoke:manual: "bash scripts/smoke/manual-checks.sh"` (package.json:13-31).
- Correct: Packaging evidence confirms `scripts/smoke/manual-checks.sh` is included in the dry-run tarball (specforge/runs/RUN-0007/commands/CMD-0005.log:16-18). A fresh `npm pack --dry-run --json` check also reported that path with executable mode 493.
- Correct: `test/package.test.ts` covers the smoke script contract by checking the package script target, packaged `files` entry, executable bit, all nine smoke assertion IDs, pass/fail markers, and product-spec alignment (test/package.test.ts:4-43).
- Correct: Validation evidence exists: `npm test` passed 38 tests including `test/package.test.ts` (specforge/runs/RUN-0007/commands/CMD-0002.log:8-18), `npm run typecheck` completed with `tsc --noEmit` and no errors (specforge/runs/RUN-0007/commands/CMD-0003.log:1-4), `npm run smoke:manual` printed the checklist (specforge/runs/RUN-0007/commands/CMD-0004.log:2-41), and `npm pack --dry-run` completed with the smoke script in tarball contents (specforge/runs/RUN-0007/commands/CMD-0005.log:1-34).
- Correct: No external install/tag/release/publish action is evidenced in CMD-0002..CMD-0005; they are limited to local npm test/typecheck/smoke/pack commands. This aligns with the scope constraint to defer section 20 GitHub-ref install validation until explicit approval, while acknowledging the section 20 release gate still requires clean install validation before tagging (docs/product-spec.md:628-652).
- Correct: Runtime/product code search found no `loop`, `campaign`, or `episode` terms in `src/`, `extensions/`, `package.json`, `scripts/`, or `test/`. Matches were limited to spec/orchestration wording, not runtime product code.
- Fixed: None; review-only task, no product files edited.
- Blocker: None.
- Note: Section 20 clean GitHub-ref install smoke remains a release-readiness residual risk, not a blocker for this scoped hardening task, because the scope explicitly disallowed external install/tag/release/publish actions.
- Note: `git status --short` shows many untracked project files and one modified tracked spec file in this repository snapshot, but `git diff --cached` was empty; no staged files were present during review.

## Findings by severity

- Blockers: none.
- Majors: none.
- Minors: none.

## Verdict

PASS — the requested tests/smoke hardening matches the cited product-spec sections for this scope, with local evidence and no external release/install mutation performed.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Reviewed docs/product-spec.md, package.json, scripts/smoke/manual-checks.sh, test/package.test.ts, and CMD-0002..CMD-0005. The change stays within docs/package/test/smoke collateral and does not add runtime loop/campaign/episode concepts or external release actions."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Cited file/line evidence and command logs for smoke assertions, package manifest, pack contents, validation commands, and no staged files."
    }
  ],
  "changedFiles": [
    "docs/product-spec.md",
    "package.json",
    "scripts/smoke/manual-checks.sh",
    "test/package.test.ts"
  ],
  "testsAddedOrUpdated": [
    "test/package.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npm test (evidence log CMD-0002)",
      "result": "passed",
      "summary": "6 test files passed, 38 tests passed."
    },
    {
      "command": "npm run typecheck (evidence log CMD-0003)",
      "result": "passed",
      "summary": "tsc --noEmit completed with no reported errors."
    },
    {
      "command": "npm run smoke:manual (evidence log CMD-0004)",
      "result": "passed",
      "summary": "Printed the manual smoke checklist with all nine named assertions and PASS/FAIL fields."
    },
    {
      "command": "npm pack --dry-run (evidence log CMD-0005)",
      "result": "passed",
      "summary": "Dry-run tarball included scripts/smoke/manual-checks.sh."
    },
    {
      "command": "npm test -- --run test/package.test.ts",
      "result": "passed",
      "summary": "Focused package smoke contract test passed: 1 file, 3 tests."
    },
    {
      "command": "npm pack --dry-run --json",
      "result": "passed",
      "summary": "Confirmed scripts/smoke/manual-checks.sh appears in pack file list with executable mode."
    },
    {
      "command": "git diff --cached --stat && git status --short",
      "result": "passed",
      "summary": "No staged files; worktree contains unstaged/untracked implementation files."
    },
    {
      "command": "grep runtime/product paths for loop|campaign|episode",
      "result": "passed",
      "summary": "No matches in src/, extensions/, package.json, scripts/, or test/."
    }
  ],
  "validationOutput": [
    "CMD-0002: Test Files 6 passed; Tests 38 passed.",
    "CMD-0003: tsc --noEmit produced no errors.",
    "CMD-0004: manual smoke checklist printed all nine named assertions with PASS/FAIL result fields.",
    "CMD-0005: npm pack dry-run tarball contents include scripts/smoke/manual-checks.sh.",
    "git diff --cached produced no output; no staged files."
  ],
  "residualRisks": [
    "Section 20 clean GitHub-ref install smoke is still deferred until explicit external-action approval and must be completed before any public tag/release announcement."
  ],
  "noStagedFiles": true,
  "diffSummary": "Spec package files contract includes scripts; package manifest includes scripts and smoke:manual; manual smoke script provides nine PASS/FAIL assertions; package test enforces the package/smoke contract.",
  "reviewFindings": [
    "no blockers",
    "no majors",
    "no minors"
  ],
  "manualNotes": "Review-only: no product files edited. The output artifact was written to the required JUDGE-0001.md path."
}
```
