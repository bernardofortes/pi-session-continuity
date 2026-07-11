# RUN-0017 Review Round 1

Verdict: REPAIR-NOW

Reviewer artifact: `.pi-subagents/artifacts/5bd2c5a9_reviewer_0_output.md`

## Findings

### F-001 — High — singleton guard was process-global, not runtime-scoped

Disposition: repaired in the next implementation pass.

Evidence:

- Initial implementation used a global active API guard in `extensions/session-continuity/index.ts`.
- Reviewer identified that this could disable Pi Session Continuity for a second independent runtime/workspace/session in the same process.

Required fix from reviewer:

- Key the guard by runtime/load-group identity, preferably `pi.events` when available.
- Use a `WeakSet<object>` of active runtime keys.
- Delete the key on `session_shutdown`.
- Add tests for duplicate same runtime, independent runtimes, and shutdown re-registration.

## Positive checks from round 1

- `turn_end` automatic triggering was removed and replaced with `context` hook triggering.
- Durable handoff invariant path remained intact: artifact write before compaction, resume prompt read from disk before `sendUserMessage`.
- `/continuity` top-level menu and direct `/continuity settings` matched scope.
- Docs/spec described safe-boundary behavior and native auto-compaction warning/no arbitration.
- Package version remained `0.1.1`; v0.1.2 documented as local/unreleased.
- Local validation had passed before this review.

## Per-claim evidence check

- Claim: safe-boundary trigger replaces `turn_end`. Status: supported by code/tests, no finding.
- Claim: durable artifact -> compaction -> disk resume invariant holds. Status: supported by unchanged handoff path and tests, no finding.
- Claim: duplicate-load guard is safe. Status: not supported in round 1; F-001 required repair.
- Claim: menu/docs/native warning scope matches user request. Status: supported, no finding.
