REPAIR-NOW

## Review

- Correct: Default runtime config is restored to 75% in `src/constants.ts`, and threshold math/tests cover 75% at 128k and 1M windows.
- Correct: Synthesis transcript input is bounded recency-first before provider calls and injected synthesizers. The prompt still includes the authority-boundary rule, frontmatter metadata, and active system prompt. Tests cover omission note/newest-context preservation and provider-call bounding.
- Correct: Durable-brief-first/resume-from-disk path remains intact: the handoff validates and writes the pending artifact before any queue, then reads `paths.pendingPath` and builds the resume prompt from that saved brief. Native compaction remains after the saved artifact step and queues from disk in `onComplete`.
- Correct: Automatic trigger still runs from the `context` hook after complete assistant/tool-result batches, not `turn_end`. No `turn_end` handler was introduced.
- Correct: Validation passed locally before review: `npm test` (68 passed), `npm run typecheck`, and `npm pack --dry-run`.
- Blocker: Documentation was internally inconsistent with the restored 75% default. The Continuity Brief frontmatter schema example still said `triggerAtPercent: 70` despite the default/config sections saying 75.

## Repair

Repaired blocker by changing the product spec frontmatter schema example to `triggerAtPercent: 75`.

Post-repair validation:

```text
npm test          passed, 68 tests
npm run typecheck passed
npm pack --dry-run passed
```
