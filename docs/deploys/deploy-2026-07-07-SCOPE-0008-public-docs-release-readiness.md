# Deploy Note: Public Docs and Release Readiness

Type: SpecForge Deploy Note
Scope ID: SCOPE-0008
Run ID: RUN-0008
Date: 2026-07-07
Status: Done
Area: Public docs and release-readiness collateral

## Delivered

- Expanded README release-validation guidance with local gates, manual smoke checklist usage, and explicit external-action approval gating.
- Updated CHANGELOG v0.1.0 notes for the packaged manual smoke checklist and docs/package contract tests.
- Added README and CHANGELOG public-doc contract coverage to `test/package.test.ts`.
- Reconfirmed MIT license and package metadata through reviewer inspection.

## Evidence

- `npm test` — passed, 6 files and 40 tests (`CMD-0002`).
- `npm run typecheck` — passed (`CMD-0003`).
- `npm pack --dry-run` — passed and included public docs/scripts (`CMD-0004`).
- Fresh reviewer judge — PASS with no blockers/majors/minors (`JUDGE-0001`).

## Decisions

- Kept clean GitHub-ref install smoke deferred behind explicit external-action approval.
- Did not perform push, tag, release, publish, upload, or repository mutation.

## Operational risks

Clean Pi install and live smoke execution remain required before public tag or announcement.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0008/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0008/`
- Judge: `specforge/runs/RUN-0008/subagents/JUDGE-0001.md`
