#!/usr/bin/env bash
set -euo pipefail

cat <<'SMOKE'
# Pi Session Continuity manual smoke checklist

Use this checklist in a clean Pi process after installing from a pinned GitHub ref.
Do not run external install/tag/release/publish steps without separate explicit approval.

Environment record:
- Pi version/commit:
- Node version:
- OS:
- Install command:
- Workspace:
- Config path:
- Artifact directory:

For each assertion, record PASS or FAIL, the command(s) run, and concrete evidence paths/output.

| ID | Assertion | Result | Evidence |
| --- | --- | --- | --- |
| manual-checkpoint-writes-artifact | `/continuity checkpoint` writes a valid Continuity Brief with required frontmatter and mandatory headings. | PASS/FAIL | |
| resume-uses-disk-artifact | The queued resume prompt contains the exact saved artifact body read from disk. | PASS/FAIL | |
| required-identity-present | Artifact includes `eventId`, `sessionId`, `sessionFile`, `createdAt`, and `updatedAt`. | PASS/FAIL | |
| reload-stale-is-inert | Reload does not inject a stale pending artifact; `/continuity status` reports it as inert. | PASS/FAIL | |
| duplicate-trigger-single-flight | Duplicate trigger while a handoff is active creates one artifact and one lock only. | PASS/FAIL | |
| threshold-percent-model-change | Threshold math preserves 65% trigger intent across at least two model context windows. | PASS/FAIL | |
| synthesis-failure-no-prompt | Forced synthesis failure queues no resume prompt and reports failure. | PASS/FAIL | |
| write-failure-no-prompt | Forced artifact write failure queues no resume prompt and reports failure. | PASS/FAIL | |
| cross-session-rejected | Artifact from another `sessionId` is not used automatically. | PASS/FAIL | |

Suggested transcript structure:

```text
[ASSERTION-ID]
command(s):
observed:
evidence path(s):
result: PASS|FAIL
```
SMOKE
