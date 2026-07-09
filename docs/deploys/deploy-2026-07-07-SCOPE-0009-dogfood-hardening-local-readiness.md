# Deploy Note: Dogfood Hardening and Local Readiness

Type: SpecForge Deploy Note
Scope ID: SCOPE-0009
Run ID: RUN-0009
Date: 2026-07-07
Status: Done
Area: Local v1 readiness decision

## Delivered

- Added the local v1 readiness report at `docs/release-readiness/local-v1-readiness-2026-07-07.md`.
- Ran final local gates for tests, typecheck, manual smoke checklist, package dry-run, and forbidden runtime terminology.
- Recorded final independent local-readiness review.
- Preserved the boundary that public release readiness still requires separate human-approved external validation.

## Evidence

- `npm test` — passed, 6 files and 40 tests (`CMD-0002`).
- `npm run typecheck` — passed (`CMD-0003`).
- `npm run smoke:manual` — printed manual checklist (`CMD-0004`).
- `npm pack --dry-run` — passed after final docs (`CMD-0007`).
- Forbidden runtime terminology grep — no matches after final docs (`CMD-0008`).
- Fresh reviewer judge — PASS with no blockers/majors and two process minors now addressed (`JUDGE-0001`).

## Decisions

- Local v1 readiness is accepted separately from public release readiness.
- External clean-install/tag/release validation remains Bernardo-only and requires explicit approval.

## Operational risks

Clean GitHub-ref Pi install/smoke is still required before any public tag or announcement.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0009/autonomous-implementation-packet.yaml`
- Readiness: `docs/release-readiness/local-v1-readiness-2026-07-07.md`
- Run: `specforge/runs/RUN-0009/`
- Judge: `specforge/runs/RUN-0009/subagents/JUDGE-0001.md`
