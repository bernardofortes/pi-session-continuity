# Deploy Note: Tests and Smoke Scripts

Type: SpecForge Deploy Note
Scope ID: SCOPE-0007
Run ID: RUN-0007
Date: 2026-07-07
Status: Done
Area: Tests and manual smoke collateral

## Delivered

- Updated the package contract to include `scripts` because `smoke:manual` points to a script file.
- Ensured `package.json` includes `scripts` in package files.
- Expanded `scripts/smoke/manual-checks.sh` into a runnable manual smoke template with environment fields, all nine required assertions, and pass/fail result columns.
- Added package/smoke contract tests covering script presence, executable bit, assertion IDs, pass/fail markers, and spec alignment.

## Evidence

- `npm test` — passed, 6 files and 38 tests (`CMD-0002`).
- `npm run typecheck` — passed (`CMD-0003`).
- `npm run smoke:manual` — printed the manual checklist (`CMD-0004`).
- `npm pack --dry-run` — passed and included `scripts/smoke/manual-checks.sh` (`CMD-0005`).
- Fresh reviewer judge — PASS with no blockers/majors/minors (`JUDGE-0001`).

## Decisions

- Kept clean GitHub-ref install smoke deferred behind explicit approval.
- Included smoke scripts in packaged files so published package scripts do not reference missing files.

## Operational risks

Clean Pi install and live smoke execution remain release-gated external validation.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0007/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0007/`
- Judge: `specforge/runs/RUN-0007/subagents/JUDGE-0001.md`
