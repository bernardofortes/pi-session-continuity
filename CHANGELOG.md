# Changelog

## 0.1.4 — 2026-07-11

- Fix synthesis abort: move `ctx.abort()` from before the handoff to after the Continuity Brief is written to disk and before compaction. Previously, aborting before synthesis killed the synthesis provider call via `ctx.signal`.

## 0.1.3 — 2026-07-11

- Restore the public/default automatic trigger threshold to 75%.
- Estimate context tokens from the real messages that will be sent to the provider, not the stale `ctx.getContextUsage()` value that only reflects the last assistant response. This mirrors pi-continue's mid-run guard and is the reason the trigger actually fires at 75% in production.
- Abort the active agent run before handoff so the next provider request does not race with synthesis and compaction.
- Bound synthesis transcript input recency-first so large branches/tool outputs do not make the Continuity Brief synthesis request exceed the model context window at the 75% trigger.

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
