# Deploy Note: Compact Status Footer

Type: SpecForge Deploy Note
Scope ID: SCOPE-0011
Run ID: RUN-0011
Date: 2026-07-08
Status: Done
Area: Status/footer UX

## Delivered

- Removed full multiline status/settings content from the persistent Pi widget path.
- Added compact footer labels such as `PSC 75/15`.
- Clear any previous `session-continuity` widget before showing new status.
- Updated the product spec to forbid persistent oversized status widgets.

## Evidence

- `npm test` — passed, 44 tests (`CMD-0001`).
- `npm run typecheck` — passed (`CMD-0002`).
- `npm pack --dry-run` — passed (`CMD-0003`).
- Forbidden runtime terminology grep — no matches (`CMD-0004`).

## Operational risks

Manual Pi TUI dogfood should confirm the previous truncated widget no longer appears.
