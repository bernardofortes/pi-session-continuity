# RUN-0017 Simplify Disposition

Verdict: keep as implemented.

## Trigger

Simplify review is required because the slice touched more than three product/docs files and the run manifest marked `simplify_required: true`.

## Disposition

The change is cohesive and should not be split further before closure:

- Product contract, docs, implementation, and tests all change the same v0.1.2 behavior boundary.
- The safe-boundary helper is small and localized in `src/trigger.ts`; it replaces an unsafe event boundary rather than adding an alternate parallel trigger system.
- The singleton repair is minimal: a global registry remains, but it is scoped by runtime/load-group key via `WeakSet`, avoiding both duplicate same-runtime registration and cross-runtime suppression.
- The implementation intentionally does not add `session_before_compact` arbitration, native compaction coexistence logic, cleanup commands, background workers, dependency changes, or release automation.
- `/continuity` menu behavior reuses existing status, checkpoint, and settings paths instead of adding duplicate settings UI.

## Rejected simplifications

- Do not use `agent_settled` only: it can be too late for long autonomous loops.
- Do not use `agent_end` only: it may still be late for long low-level runs.
- Do not keep `turn_end`: it can compact while the agent/tool-call cycle is active.
- Do not copy `pi-continue` wholesale: PSC only needs the safe-boundary concept and complete tool-result batch guard.

## Remaining limitation

Automatic handoff now triggers only at completed assistant/tool-result batch boundaries. Normal no-tool prompt/response sessions will not automatic-handoff under this v0.1.2 design. That is accepted for this local release scope and documented as a known limitation.
