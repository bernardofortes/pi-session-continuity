# Review: RUN-0019 — Trigger Estimate + Abort

**Verdict: PASS**

All six review criteria are satisfied. Implementation is correct, well-tested (70/70 tests pass, `tsc --noEmit` clean), and the durable-brief-first / resume-from-disk invariant is preserved.

---

## 1. Token estimate from real event.messages via estimateContextTokens — ✅ PASS

`extensions/session-continuity/index.ts:306-312`:

```ts
const contextWindow = ctx.model?.contextWindow ?? 0;
const estimate = await estimateContextTokensFromMessages(event.messages);
const usage: ContextUsageSnapshot | undefined =
    estimate !== null
        ? { tokens: estimate.tokens, contextWindow }
        : getContextUsage(ctx);
```

- `estimateContextTokensFromMessages` (`src/pi-internals.ts:47-58`) loads Pi's internal `estimateContextTokens` from `@earendil-works/pi-coding-agent/dist/core/compaction/compaction.js` at runtime via `require.resolve` + dynamic import. The target export exists in the installed dist tree (verified: `grep estimateContextTokens` finds it in the real file).
- The estimate is computed from `event.messages` — the real messages that will be sent to the provider — not from the stale `ctx.getContextUsage()` snapshot.
- `estimate.tokens` (total estimated context tokens) is the correct field for the trigger decision.

## 2. Abort active run before handoff — ✅ PASS

`extensions/session-continuity/index.ts:334`:

```ts
ctx.abort();
```

Called after the threshold decision and cooldown check pass, but before `ctx.ui.notify(...)` and `await runContinuityHandoff(...)`. This matches the pi-continue mid-run guard pattern: abort first, then write brief, compact, and resume.

Test coverage: `test/extension-command.test.ts:431` asserts `expect(ctx.abort).toHaveBeenCalledTimes(1)` in the automatic trigger path.

## 3. Fallback to ctx.getContextUsage() when estimate unavailable — ✅ PASS

`extensions/session-continuity/index.ts:310-312`:

```ts
const usage: ContextUsageSnapshot | undefined =
    estimate !== null
        ? { tokens: estimate.tokens, contextWindow }
        : getContextUsage(ctx);
```

When `estimateContextTokensFromMessages` returns `null` (Pi internals cannot be loaded or the function throws), the code falls back to `getContextUsage(ctx)` (`extensions/session-continuity/index.ts:123-131`), which itself safely handles `ctx.getContextUsage` being undefined or throwing. If both are unavailable, `decideAutomaticTrigger(config, undefined)` returns `usage-unavailable` and the trigger is skipped with a once-per-session warning.

Test coverage: `test/extension-command.test.ts:462-464` verifies the null-estimate fallback path (with `getContextUsage: undefined`) correctly suppresses triggering and warns once.

## 4. Default trigger at 75% — ✅ PASS

`src/constants.ts:59`: `export const DEFAULT_TRIGGER_AT_PERCENT = 75;`

Changed from 70 to 75. All dependent tests updated:

- `test/config.test.ts`: defaults assertion and `shouldTriggerHandoff` boundary tests updated to 75% boundaries (95_999/96_000 for 128k, 749_999/750_000 for 1M).
- `test/trigger.test.ts`: `decideAutomaticTrigger` boundary tests updated to 75%.
- `test/status.test.ts`: status panel and footer text updated to 75%.
- `docs/product-spec.md` and `README.md`: all references updated to 75%.

## 5. Durable-brief-first / resume-from-disk invariant — ✅ PRESERVED

The `runContinuityHandoff` flow (`src/handoff.ts:548-690`) is unchanged in its ordering:

1. Acquire session lock.
2. Synthesize Continuity Brief body.
3. Validate brief.
4. **Write brief to disk** (`writeTextFile(paths.pendingPath, pendingContent)`) — `src/handoff.ts:582`.
5. If compaction requested: call `ctx.compact({ onComplete })`; in `onComplete`, **read the brief back from disk** (`readTextFile(paths.pendingPath)`) and build the resume prompt from the saved artifact (`queueResumeFromSavedBrief`, `src/handoff.ts:491-498`).
6. Archive only after the resume prompt is queued from disk.
7. On any synthesis/write/validation failure: write a failed artifact and queue **no** resume prompt (`src/handoff.ts:680-700`).

The `ctx.abort()` call does not interfere — it stops the active provider run, then the handoff writes the brief and queues `pi.sendUserMessage(resumePrompt, { deliverAs: "followUp" })` for the next run. The abort-first ordering actually *strengthens* the invariant by preventing the next provider request from racing with synthesis.

## 6. Race conditions, error handling, correctness — ✅ No blockers

**Investigated and found sound:**

- **Double-abort race**: The single-flight guard (`state.activeBySession.has(sessionId)` + fresh lock sentinel check) lives inside `runContinuityHandoff` (`src/handoff.ts:422-444`), which is called *after* `ctx.abort()`. If two context events both pass the threshold before either reaches the guard, both call `ctx.abort()`, but the second `runContinuityHandoff` is rejected by the single-flight guard. A redundant `abort()` call is benign (idempotent signal). After the first abort, no further context events fire for that run. No blocker.

- **abort() not wrapped in try/catch**: If `ctx.abort()` throws, the context handler promise rejects and no handoff proceeds. State remains clean (no lock acquired, no active operation set). This is correct fail-safe behavior — if abort fails, the handoff should not proceed.

- **boundSynthesisTranscript double-call**: When using the default synthesizer, `runContinuityHandoff` bounds the transcript (`src/handoff.ts:570-573`) using `frontmatter.contextWindow`, then `synthesizeWithModel` bounds again (`src/handoff.ts:233-237`) using `model.contextWindow ?? frontmatter.contextWindow`. This is idempotent — the second call is a no-op when the text already fits. If the model window differs, the second bounding correctly applies the tighter budget. Not a bug.

- **boundSynthesisTranscript edge cases**: When `contextWindow` is 0, `deriveSynthesisTranscriptBudgetTokens` returns `max(16384, 0) = 16384` tokens (the `SYNTHESIS_TRANSCRIPT_MIN_TOKENS` floor). When `budgetChars - omissionNote.length - 2` would be negative, `tailBudgetChars` clamps to 0, yielding an empty tail with just the omission note. Both edge cases are handled gracefully.

- **`tokenCountAtTrigger` in frontmatter** (`src/handoff.ts:315`): Uses `ctx.getContextUsage()` (the "stale" value) for the frontmatter metadata record. This is metadata only — the trigger *decision* uses the real estimate. Not a correctness issue; the frontmatter is a best-effort record.

- **pi-internals module resolution**: `require.resolve("@earendil-works/pi-coding-agent")` → `dirname()` → `join(distRoot, "core/compaction/compaction.js")`. Verified the real file exists at `/home/ubuntu/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/compaction/compaction.js` and exports `estimateContextTokens`. The `try/catch` in `estimateContextTokensFromMessages` returns `null` on any resolution/import failure, triggering the fallback path.

---

## Validation Evidence

```
npm test       → 9 files, 70 tests passed, 0 failed
npm run typecheck → tsc --noEmit, clean (no errors)
npm pack --dry-run → (not run in this review; not a behavior-change gate)
```

## Notes (non-blocking)

- **Minor test gap**: There is no explicit test for the specific fallback path where `estimateContextTokensFromMessages` returns `null` *and* `ctx.getContextUsage()` returns valid data (trigger should still fire from the fallback usage). The existing fallback test only covers the case where both are unavailable. The code path is correct by inspection, but an explicit test would strengthen confidence in the fallback-to-getContextUsage branch.
- **`buildFrontmatterForContext` uses stale `getContextUsage()`** for `tokenCountAtTrigger` metadata. This is acceptable (metadata only, not the trigger input), but if a future agent misreads it as the trigger source, it could cause confusion. The code comment at `extensions/session-continuity/index.ts:304-307` clarifies the distinction.
