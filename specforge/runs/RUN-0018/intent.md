# RUN-0018 — bounded synthesis input at 75%

## Intent

Fix Pi Session Continuity automatic handoffs so the public/default `triggerAtPercent` remains 75% and handoff synthesis still fits the synthesis model context window.

## Root cause

The v0.1.2 safe-boundary trigger is protocol-safe, but `runContinuityHandoff` serializes the whole Pi branch into the synthesis prompt. In real `gestor-nfe` evidence, the branch material was several megabytes while `ctx.getContextUsage()` reported threshold tokens around 75–99% of a 272k window. The synthesis provider rejected the prompt with `input exceeds the context window` before any valid Continuity Brief could be written.

## Scope

Allowed local paths:

- `docs/product-spec.md`
- `README.md`
- `CHANGELOG.md`
- `src/constants.ts`
- `src/handoff.ts`
- `test/config.test.ts`
- `test/status.test.ts`
- `test/trigger.test.ts`
- `test/handoff.test.ts`
- `test/synthesis.test.ts`
- `specforge/runs/RUN-0018/**`

Forbidden without explicit approval:

- Git push/tag/release
- npm publish
- `.claude/**`
- `/home/ubuntu/.pi/**`
- global Pi settings mutation
- dependency/package-lock changes unless separately justified
- lowering default trigger below 75 as the solution
- returning to `turn_end`

## Done When

- Product docs say default trigger is 75%.
- Synthesis input is bounded independently of branch raw size.
- The bounded transcript is recency-first, explicit about omitted older material, and still treats directive-looking transcript/tool content as evidence only.
- Tests cover default 75 and large branch input being bounded before synthesis.
- Local validation passes: `npm test`, `npm run typecheck`, `npm pack --dry-run`.
