# Changelog

## 0.1.2 — 2026-07-11

- Move automatic threshold checks from `turn_end` to the Pi `context` hook before the next provider request.
- Add a safe-boundary guard so automatic handoffs only run after a complete assistant/tool-result batch.
- Change `/continuity` with no args to open a top-level menu: Status, Create checkpoint now, Settings, Done; `/continuity settings` remains direct.
- Strengthen the native Pi auto-compaction warning: reliable automatic PSC handoffs require `compaction.enabled=false`; no native compaction arbitration is implemented.
- Suppress repeated context-usage-unavailable warnings for the same session/config while preserving one visible diagnostic.
- Add a duplicate runtime-load guard so only the first package copy registers commands/events in a process/runtime.

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
