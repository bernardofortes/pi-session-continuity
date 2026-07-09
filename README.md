# Pi Session Continuity

Pi Session Continuity is a Pi package that creates durable, explicit handoffs for long-running work. Before it queues any continuation prompt, it writes and validates an on-disk **Continuity Brief** and then injects the resume prompt from that saved file.

Core invariant:

```text
Durable Continuity Brief first.
Resume prompt is injected from the disk artifact.
Compaction is token hygiene, not the source of continuity.
```

## Installation

First public release is intended for a pinned GitHub tag:

```bash
pi install git:github.com/<owner>/pi-session-continuity@v0.1.0
```

For local development only:

```bash
pi -e /path/to/pi-session-continuity
```

Do not install from sources you do not trust. Pi packages execute with local user permissions.

## Quick start

```text
/continuity
/continuity status
/continuity checkpoint
```

`/continuity` opens the settings/config menu in interactive Pi TUI sessions. `/continuity checkpoint` performs a full Continuity Handoff: synthesize, validate, write the Continuity Brief, re-read it from disk, and queue the resume prompt from that saved content.

## Commands

- `/continuity` — opens the same settings/config menu as `/continuity settings` in interactive Pi TUI sessions.
- `/continuity status` — shows a human-readable status panel with enabled/disabled state, trigger and keep percentages, synthesis model and effort, artifact directory, active operation, last checkpoint, last artifact, failures, and stale same-session pending artifacts.
- `/continuity checkpoint` — manually creates a disk-backed Continuity Brief and queues a resume prompt from it.
- `/continuity settings` — opens an interactive settings menu in Pi TUI so you can view/change public config values such as `triggerAtPercent` without manually editing JSON. In non-interactive contexts, the same command falls back to textual output.

## Configuration

Project-local config is read only when the project is trusted:

```text
<workspace>/<CONFIG_DIR_NAME>/session-continuity.json
```

`CONFIG_DIR_NAME` is supplied by Pi and is normally `.pi`.

Defaults:

```json
{
  "enabled": true,
  "triggerAtPercent": 75,
  "keepRecentPercent": 20,
  "synthesisModel": "inherit",
  "synthesisEffort": "medium",
  "artifactDirectory": "session-continuity"
}
```

`synthesisEffort` controls Continuity Brief synthesis reasoning/thinking level and accepts `inherit`, `minimal`, `low`, `medium`, `high`, or `xhigh`. `artifactDirectory` resolves under `<workspace>/<CONFIG_DIR_NAME>/` unless absolute. Invalid config disables automatic behavior and reports the config path.

In interactive Pi sessions, `/continuity settings` can update this file for the public config fields. In non-interactive contexts, edit the JSON directly or run `/continuity settings` for textual inspection.

## Artifact layout

```text
<artifactDirectory>/<sessionId>/pending/<eventId>.md
<artifactDirectory>/<sessionId>/archive/<timestamp>-<eventId>.md
<artifactDirectory>/<sessionId>/failed/<timestamp>-<eventId>.md
<artifactDirectory>/<sessionId>/lock/<eventId>.json
```

Artifacts from other sessions are inert. Same-session stale pending artifacts after reload are reported but not injected automatically.

Successful handoffs are archived per session. After each successful archive, Pi Session Continuity keeps only the newest 10 archived Continuity Briefs for that session and deletes older archived briefs automatically.

## Privacy and security

Continuity Briefs are local files that may contain prompts, tool output, file paths, command results, and sensitive project context. v0.1.0 does not guarantee secret redaction. Choose artifact directories and ignore rules accordingly.

This package must not push, publish, create repositories, upload artifacts, or mutate external systems.

## Manual smoke and release validation

Local package gates:

```bash
npm test
npm run typecheck
npm run smoke:manual
npm pack --dry-run
```

`npm run smoke:manual` prints a checklist template for the required clean Pi smoke assertions. The checklist must be executed from a clean Pi install pinned to a GitHub ref before any public tag or announcement. Record the Pi version, Node version, OS, install command, smoke transcript, and resulting artifact path.

External validation commands such as `pi install git:github.com/<owner>/pi-session-continuity@v0.1.0`, git tags, releases, npm publishing, or uploads require separate explicit human approval.

## Known limitations in v0.1.0

- Local Pi sessions only.
- No user-facing cleanup command.
- No cross-machine sync or cloud storage.
- GitHub clean-install smoke is required before public announcement.
- npm publishing is deferred.

## Troubleshooting

- Invalid config: fix the JSON at the reported path; automatic behavior stays disabled until corrected.
- Synthesis failure: no resume prompt is queued; inspect the failed artifact path if one was written.
- Write failure: no resume prompt is queued; fix filesystem permissions or artifact path.
- Stale pending artifact: `/continuity status` reports it as inert; v0.1.0 will not silently inject it after reload.
- Untrusted project: trust the project before relying on project-local config or automatic behavior.

## Update / uninstall

```bash
pi update --extension git:github.com/<owner>/pi-session-continuity@v0.1.0
pi remove git:github.com/<owner>/pi-session-continuity
```

Removing the package stops loading the extension. Existing local artifacts remain on disk unless you remove them manually.

## Compatibility

Developed against Pi CLI/package APIs from `@earendil-works/pi-coding-agent` 0.80.x, Node.js 22, and Linux. Record exact Pi version, OS, install command, and smoke transcript before tagging a public release.
