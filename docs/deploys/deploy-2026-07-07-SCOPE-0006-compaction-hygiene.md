# Deploy Note: Compaction Hygiene Hardening

Type: SpecForge Deploy Note
Scope ID: SCOPE-0006
Run ID: RUN-0006
Date: 2026-07-07
Status: Done
Area: Compaction hygiene

## Delivered

- Added focused handoff tests proving compaction is requested only after a successful disk-backed resume path.
- Verified compaction custom instructions include the archive artifact path and `keepRecentPercent`-derived token count.
- Added failure-path tests proving validation failure and post-queue archive/update failure do not request compaction.
- Reconfirmed compaction setup failure remains a warning and does not invalidate archived handoff success.

## Evidence

- `npm test` — passed, 5 files and 35 tests (`CMD-0002`).
- `npm run typecheck` — passed (`CMD-0003`).
- `npm pack --dry-run` — passed (`CMD-0004`).
- Fresh reviewer judge — PASS with no blockers/majors/minors (`JUDGE-0001`).

## Decisions

- Kept compaction as token hygiene only.
- Did not change runtime implementation because the hardened tests proved the existing behavior.
- Did not add cleanup or compaction commands.

## Operational risks

Live Pi compaction behavior remains source/test validated only until a clean smoke run is approved.

## Artifact refs

- Packet: `specforge/scopes/SCOPE-0006/autonomous-implementation-packet.yaml`
- Run: `specforge/runs/RUN-0006/`
- Judge: `specforge/runs/RUN-0006/subagents/JUDGE-0001.md`
