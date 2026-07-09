# Deploy Note: Status Panel Simplification and Synthesis Effort

Type: SpecForge Deploy Note
Run ID: RUN-0014
Date: 2026-07-08
Status: Done
Area: Status/settings UX and synthesis config

## Delivered

- `/continuity status` now shows one formatted status panel without a duplicate diagnostics block.
- Added public `synthesisEffort` config: `inherit`, `off`, `minimal`, `low`, `medium`, `high`, or `xhigh`.
- `/continuity settings` exposes synthesis effort in the menu.
- Continuity Brief synthesis passes configured effort to the model call and records it in frontmatter.

## Evidence

- `npm test` — passed, 45 tests (`RUN-0014/CMD-0001`).
- `npm run typecheck` — passed (`RUN-0014/CMD-0002`).
- `npm pack --dry-run` — passed (`RUN-0014/CMD-0003`).
- Forbidden runtime terminology grep — no matches (`RUN-0014/CMD-0004`).
