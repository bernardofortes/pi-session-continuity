## Review

### Verdict

Not a broad overengineering problem in the public package surface: the core layout, package manifest, README/CHANGELOG/LICENSE, command namespace, config source, and disk-backed handoff shape mostly track `docs/product-spec.md`. However, there is one lifecycle blocker and several majors that should be fixed before claiming SCOPE-0001/v0.1.0 readiness.

### Correct

- `package.json:1-47` matches the expected package identity, `pi-package` keyword, Pi extension entrypoint, scripts, and peer dependency placement for imported Pi packages.
- `extensions/session-continuity/index.ts:17-45` uses `session_start` and `turn_end`, and registers one `/continuity` command namespace.
- `src/handoff.ts:246-254` preserves the core invariant for the happy path: write pending artifact, re-read from disk, then queue `pi.sendUserMessage()`.
- Validation passed locally: `npm test`, `npm run typecheck`, and `npm pack --dry-run` all succeeded.

### Blockers

- **Blocker: `src/handoff.ts:251-282` — post-injection failures are handled as “no prompt queued.”** The resume prompt is sent at lines 253-254, but archive happens in the same `try` at line 257; any archive/status failure then falls into the catch at lines 271-282, can write a failed artifact, and notifies `${PRODUCT_NAME} failed: ... No resume prompt was queued.` even though the prompt may already have been queued. This also skips the spec state machine `pending -> injected -> archived` (`docs/product-spec.md:227-233`). Required fix: split pre-send failures from post-send/archive failures; once `sendUserMessage` succeeds, never write a “No resume prompt was queued” failure for that event. Persist `injected` or archive safely, and report archive failure accurately.

### Majors

- **Major: `src/artifact.ts:218-221` and `test/artifact.test.ts:68-73` — invented directive blacklist rejects valid evidence.** The validator rejects any brief body containing phrases like `ignore previous instructions`, but the spec allows directive-looking transcript/file/tool content to be recorded as observed evidence and only forbids promoting it above active authority (`docs/product-spec.md:473-491`, `503-516`). Required removal: drop the naive phrase blacklist and its test, or replace with a narrowly testable contract that does not reject quoted/observed evidence.
- **Major: `src/handoff.ts:217-233`, `src/status.ts:14-31`, `extensions/session-continuity/index.ts:28-31` — on-disk lock is write-only.** The code writes a lock sentinel before synthesis, but duplicate suppression only checks the in-memory latch, and startup/status only scans pending `.md` files. This misses the spec’s lock+pending reload reporting and stale-lock behavior (`docs/product-spec.md:452-467`, `595-599`). Required fix: implement minimal same-session lock+pending inspection/duplicate handling, or avoid claiming that the on-disk single-flight contract is complete.
- **Major: `test/handoff.test.ts:90-154` — tests do not cover key lifecycle regressions.** Missing coverage includes artifact-write/archive failure after prompt queue, stale pending+lock inertness, and true lock-sentinel single-flight. These are explicitly required by `docs/product-spec.md:503-528` and would catch the blocker above.

### Minors / required removals

- **Minor: `.pi-subagents/` is untracked and not ignored (`.gitignore:1-5`).** This contains local reviewer artifacts/transcripts and should not be committed to a public package repo. Required removal/ignore before commit: keep `.pi-subagents/` out of source control. Treat `.orchestrate/` and `specforge/` as process evidence only; they are excluded from `npm pack`, but should not be part of the public package surface unless intentionally retained.
- **Minor: `src/constants.ts:58-61` declares unused internal constants (`MIN_RESERVE_TOKENS`, `MAX_KEEP_RECENT_TOKENS`, `ARCHIVE_RETENTION`).** They are allowed by the spec, but unused constants are premature surface area. Required simplification: remove until implemented, or wire them into behavior/tests.

### Residual risks

- `plan.md` and `progress.md` requested by the task were absent in the worktree; review used `docs/product-spec.md`, git status, source, tests, README, package metadata, and local validation commands.
- Clean Pi install/smoke from a GitHub ref was not run, consistent with the external-mutation gate.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete findings cite src/handoff.ts, src/artifact.ts, src/status.ts, extensions/session-continuity/index.ts, tests, .gitignore, package.json, and docs/product-spec.md with severities."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/63843112/specforge/runs/RUN-0001/subagents/SIMPLIFY-0001.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npm test",
      "result": "passed",
      "summary": "Vitest: 3 files, 15 tests passed."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "tsc --noEmit completed without errors."
    },
    {
      "command": "npm pack --dry-run",
      "result": "passed",
      "summary": "Dry-run package contains 11 files; process artifacts are excluded from tarball."
    },
    {
      "command": "git diff --cached --quiet && echo no-staged-files || echo staged-files-present",
      "result": "passed",
      "summary": "No staged files."
    }
  ],
  "validationOutput": [
    "npm test: 15 passed",
    "npm run typecheck: passed",
    "npm pack --dry-run: package size 20.3 kB, unpacked 70.5 kB, total files 11",
    "git status shows untracked implementation/process files; no staged files"
  ],
  "residualRisks": [
    "plan.md and progress.md were not present, so they could not be reviewed.",
    "Clean Pi install/smoke from a GitHub ref was not run due external approval gate.",
    "Review did not edit source files."
  ],
  "noStagedFiles": true,
  "diffSummary": "New package skeleton and implementation files are untracked: package metadata/docs, extension entrypoint, src helpers, tests, smoke script, process artifacts, and .gitignore.",
  "reviewFindings": [
    "blocker: src/handoff.ts:251-282 - archive/status errors after sendUserMessage can be reported as 'No resume prompt was queued' and written as failed after a prompt may already have been queued.",
    "major: src/artifact.ts:218-221 - naive directive phrase blacklist invents scope beyond the spec and rejects valid observed evidence.",
    "major: src/handoff.ts:217-233 and src/status.ts:14-31 - on-disk lock is written but not used for reload/status/single-flight behavior.",
    "major: test/handoff.test.ts:90-154 - lifecycle tests miss artifact-write/archive failure, stale lock+pending inertness, and true on-disk duplicate suppression.",
    "minor: .gitignore:1-5 - .pi-subagents/ is untracked and not ignored; keep local transcript artifacts out of source control.",
    "minor: src/constants.ts:58-61 - unused internal constants should be removed until implemented or wired into behavior/tests."
  ],
  "manualNotes": "No source edits were made; only the required review artifact was written."
}
```
