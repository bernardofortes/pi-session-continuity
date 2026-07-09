# Deploy Note: Core Artifact Engine Hardening

Type: SpecForge Deploy Note
Scope ID: SCOPE-0002
Run ID: RUN-0002
Date: 2026-07-07
Status: Done
Area: Artifact/config core

## Delivered

- Hardened Continuity Brief validation for schema version, string identity fields, numeric fields, percentage bounds, and keep/trigger ordering.
- Enforced the product-spec status state machine for artifact status updates.
- Restricted resume prompt input to valid `pending` Continuity Brief artifacts only.
- Rejected relative `artifactDirectory` values that escape `<workspace>/<CONFIG_DIR_NAME>/`; absolute paths remain explicitly allowed.
- Added focused artifact/config tests for the hardened contract.

## Evidence

- `npm test` — passed, 4 files and 26 tests (`CMD-0003`).
- `npm run typecheck` — passed (`CMD-0004`).
- `npm pack --dry-run` — passed (`CMD-0005`).
- Fresh reviewer judge — PASS with no blockers/majors/minors (`JUDGE-0001`).

## Decisions

- Kept this slice focused on core artifact/config behavior only.
- Did not change `docs/product-spec.md`.
- Did not add commands, cleanup behavior, or external install/release steps.

## Operational risks

Clean Pi install and live manual smoke remain release-gated future evidence. The directive-promotion detector remains intentionally heuristic and can be expanded in a later hardening slice if needed.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0002/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0002/`
- Judge: `specforge/runs/RUN-0002/subagents/JUDGE-0001.md`
