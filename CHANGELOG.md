# Changelog

## 0.1.5 — 2026-07-11

- Restore the public/default automatic trigger threshold to 75%.
- Keep the `turn_end` automatic trigger from v0.1.1 (revert the `context` hook experiment from v0.1.2-v0.1.4). The automatic trigger now measures against `ctx.getContextUsage()` only, which reflects the last assistant response. The message-aware token estimator from v0.1.3 (`estimateContextTokensFromMessages`) and the complete-batch guard (`hasCompleteAssistantToolResultBatch`) were removed alongside the `context` hook.
- Change `/continuity checkpoint` (manual) to save only: it writes the Continuity Brief to disk as pending but does not queue a resume prompt or request compaction. Only the automatic threshold trigger does the full handoff (compact + resume from disk).
- Change `/continuity` with no args to open a top-level menu: Status, Create checkpoint now, Settings, Done.
- Add a duplicate runtime-load guard so only the first package copy registers commands/events in a process/runtime.
- Bound synthesis transcript input recency-first so large branches/tool outputs do not make the Continuity Brief synthesis request exceed the model context window.
- Suppress repeated context-usage-unavailable warnings for the same session/config.
- Strengthen the native Pi auto-compaction warning.

## 0.1.1 — 2026-07-09

- Change the default automatic threshold from 75% to 70% to reduce immediate contention with Pi native auto-compaction thresholds.
- Warn on session load when native Pi auto-compaction is still enabled while Pi Session Continuity automatic behavior is enabled.
- Document the recommended project-local Pi setting `compaction.enabled=false` for projects that want Pi Session Continuity to own automatic handoffs.

## 0.1.0 — 2026-07-09

- Add Pi package manifest for `pi-session-continuity`.
- Add `/continuity status`, `/continuity checkpoint`, and `/continuity settings` extension entrypoint.
- Add project-local config validation and trusted-project gating.
- Add Continuity Brief frontmatter, mandatory heading validation, artifact pathing, failed artifact handling, and disk-backed resume prompt construction.
- Add automatic threshold check and single-flight duplicate suppression.
- Add local unit tests and a packaged manual smoke checklist covering the required clean Pi smoke assertions.
- Add package/docs contract tests for the smoke script and public documentation collateral.

Public tag, GitHub install smoke, npm publish, and external release announcement remain gated by explicit human approval.
