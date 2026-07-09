# Deploy Note: Remove Settings Show From TUI

Type: SpecForge Deploy Note
Run ID: RUN-0012
Date: 2026-07-08
Status: Done
Area: Settings UX

## Delivered

- Removed `settings show` from command completions and TUI behavior.
- Removed `Show current settings` from the settings menu.
- Kept `/continuity settings` as the single settings view in TUI, with textual fallback only outside TUI.

## Evidence

- `npm test` — passed, 44 tests (`RUN-0012/CMD-0001`).
- `npm run typecheck` — passed (`RUN-0012/CMD-0002`).
- `npm pack --dry-run` — passed (`RUN-0012/CMD-0003`).
- Forbidden runtime terminology grep — no matches (`RUN-0012/CMD-0004`).
