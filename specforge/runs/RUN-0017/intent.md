# RUN-0017 Intent — Pi Session Continuity v0.1.2 local hardening

## User request

Implement Pi Session Continuity v0.1.2 locally in `/home/ubuntu/pi-session-continuity`, end-to-end, using SpecForge Flow.

## Approved scope

- Replace unsafe automatic trigger behavior:
  - stop using `turn_end` for automatic handoff triggers;
  - use a safe mid-run boundary inspired by `pi-continue`: evaluate in the `context` hook, only when messages end with a complete tool-result batch, before the next provider request;
  - do not rely solely on `agent_settled`, because long autonomous loops may not settle soon enough.
- Keep the product simple:
  - no complex native compaction arbitration/coexistence;
  - reliable automatic PSC handoffs require native Pi auto-compaction disabled;
  - warn strongly when native Pi auto-compaction is enabled.
- Add a singleton/runtime duplicate-load guard so accidental duplicate installs register only one copy of commands/events.
- Improve `/continuity` UX:
  - `/continuity` opens a top-level menu with Status, Create checkpoint now, Settings, Done;
  - `/continuity settings` remains a direct shortcut to the settings menu;
  - do not duplicate settings UI.
- Reduce repeated `usage unavailable` warnings after compaction.
- Improve product docs/positioning to clearly explain the end-to-end flow:
  1. save current context/state into a durable Continuity Brief on disk;
  2. request compaction while preserving a configured amount of recent useful raw tokens;
  3. reinject/queue the resume prompt from the saved disk artifact.

## Hard constraints

- Local repo edits only.
- No npm publish.
- No GitHub push.
- No tag creation/push.
- No `.claude` publication/install.
- No global Pi package settings mutation or reinstall.
- Preserve the invariant: Durable Continuity Brief first; resume prompt from disk artifact; compaction is token hygiene, not continuity source.
