# RUN-0019 — real-time trigger estimate + abort

## Intent

Fix the v0.1.2 automatic trigger that does not fire in production because it uses `ctx.getContextUsage()` (stale, last assistant response) instead of estimating tokens from the real messages that will be sent to the provider.

## Root cause

The `context` hook handler called `decideAutomaticTrigger(config, getContextUsage(ctx))`. `ctx.getContextUsage()` returns the `usage.totalTokens` from the last assistant response. In rapidly growing sessions (like `gestor-nfe`), this value lags behind the real context size. The trigger never fires because the stale value stays below 75%, even when the real context is at or above the threshold.

`pi-continue` solves this by calling Pi's internal `estimateContextTokens(messages)` on the real messages in the `context` hook. This function:

1. Gets `usage.totalTokens` from the last assistant message with usage data.
2. Sums `estimateTokens()` for all trailing messages after it.
3. Returns `tokens = usageTokens + trailingTokens`.

This gives a real-time estimate that reflects the actual context size.

A second issue: PSC did not abort the active agent run before starting the handoff. Without abort, the next provider request could race with synthesis and compaction. `pi-continue` calls `ctx.abort()` before compaction.

## Scope

Allowed local paths:

- `src/pi-internals.ts` (new)
- `extensions/session-continuity/index.ts`
- `test/extension-command.test.ts`
- `test/pi-internals.test.ts` (new)
- `docs/product-spec.md`
- `README.md`
- `CHANGELOG.md`
- `specforge/runs/RUN-0019/**`

Forbidden without explicit approval:

- Git push/tag/release
- npm publish
- `.claude/**`
- `/home/ubuntu/.pi/**`
- global Pi settings mutation
- lowering default trigger below 75
- returning to `turn_end`

## Done When

- Trigger estimates tokens from real `event.messages` using `estimateContextTokens`.
- Falls back to `ctx.getContextUsage()` if estimate is unavailable.
- Aborts active run before handoff.
- Default trigger remains 75%.
- Tests cover estimate-based trigger and abort.
- Local validation passes.
