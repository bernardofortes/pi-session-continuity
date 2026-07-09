# Deploy Note: Package Skeleton

Type: SpecForge Deploy Note
Scope ID: SCOPE-0001
Run ID: RUN-0001
Date: 2026-07-07
Status: Done
Area: Pi package/extension

## Delivered

- Created the public package skeleton for Pi Session Continuity.
- Added the `/continuity` extension entrypoint and core config/artifact/handoff helpers.
- Added tests for config, artifact validation, disk-backed prompt use, failures, stale status, and locks.
- Added README, CHANGELOG, LICENSE, and smoke checklist scaffold.

## Files touched

- `package.json` / `tsconfig.json` — package metadata and local validation scripts.
- `extensions/session-continuity/index.ts` — Pi extension command and threshold wiring.
- `src/` — config, artifact, handoff, constants, and status modules.
- `test/` — unit coverage for the initial contract.
- `scripts/smoke/manual-checks.sh` — named manual smoke checklist.

## Evidence

- `npm test` — passed, 4 files and 22 tests (`CMD-0009`).
- `npm run typecheck` — passed (`CMD-0010`).
- `npm pack --dry-run` — passed, 11 packaged files (`CMD-0011`).
- Runtime source grep found no `loop`, `campaign`, or `episode` terms.

## Decisions

- Kept external install/tag/release/publish out of scope.
- Used project-local config only and `CONFIG_DIR_NAME` for path resolution.
- Added an extra `.active` lock directory as an atomic local guard while preserving event lock files.

## How it works now

The extension loads config from the trusted project, reports `/continuity status`, and can run a manual or threshold handoff. The handoff writes and validates a pending Continuity Brief, re-reads it from disk for the prompt, marks it injected, archives it, and only then attempts compaction hygiene.

## Future notes

Clean Pi install and live command smoke from a GitHub ref remain required before public release.

## Operational risks

Continuity Briefs may contain sensitive local session context. v0.1.0 does not redact secrets. The `.active` lock is local filesystem coordination only, not cross-machine locking.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0001/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0001/`
