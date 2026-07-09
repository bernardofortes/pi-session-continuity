# Deploy Note: UX Settings Menu

Type: SpecForge Deploy Note
Scope ID: SCOPE-0010
Run ID: RUN-0010
Date: 2026-07-08
Status: Done
Area: Status/settings UX

## Delivered

- Updated the product spec to require human-facing status/settings UX and an interactive settings menu.
- Changed status/settings output to put readable labels first while preserving diagnostic paths and fields.
- Routed detailed TUI output through a widget with concise headline notifications.
- Added `/continuity settings show` as the textual fallback.
- Added interactive `/continuity settings` flows for enabled, trigger threshold, keep percent, synthesis model, and artifact directory.
- Added project-local config write helpers that validate drafts before writing.

## Evidence

- `npm test` — passed, 43 tests (`CMD-0002`).
- `npm run typecheck` — passed (`CMD-0003`).
- `npm pack --dry-run` — passed (`CMD-0004`).
- Forbidden runtime terminology grep — no matches (`CMD-0005`).
- Fresh reviewer judge — PASS with no blockers/majors/minors (`JUDGE-0001`).

## Decisions

- Keep the single project-local config source of truth.
- Keep manual/live TUI navigation as the remaining dogfood validation item; code and tests cover persistence and command fallback.
- Do not change handoff/artifact semantics in this UX slice.

## Operational risks

Interactive `/continuity settings` navigation should still be manually dogfooded in Pi TUI before removing Pi Continue.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0010/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0010/`
- Judge: `specforge/runs/RUN-0010/subagents/JUDGE-0001.md`
