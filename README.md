# Pi Session Continuity

**Keep long-running Pi coding sessions moving without losing the plot.**

Pi Session Continuity exists so extended agentic coding work can survive the boring failure modes: a context window fills up, a session reloads, a compaction happens, or the next agent has to recover the state of the task. Its job is not to be clever, visible, or exciting. Its job is to be dull enough that you forget it is there — until the moment it quietly gives the next session a reliable handoff.

Only after that intent is clear does the mechanism matter: Pi Session Continuity is a Pi package that writes a structured **Continuity Brief** to disk before it queues any resume prompt. The continuation is driven from the saved artifact, not from fragile in-memory state.

## Why this exists

Long-running agentic coding work often fails at the worst possible boundary: the session is full, the model is tired, the transcript is noisy, and the next prompt has to reconstruct what matters. A normal compaction can reduce tokens, but compaction is still an in-session memory-management step. If the handoff itself fails, or if a reload happens at the wrong time, the recovery story can become ambiguous.

Pi Session Continuity turns that risky boundary into a small, repeatable reliability step:

1. synthesize the current state of the work;
2. write and validate a disk-backed Continuity Brief;
3. re-read the saved file;
4. queue the resume prompt from that exact file;
5. use native compaction only as token hygiene after the durable path is safe.

Core invariant:

```text
Durable Continuity Brief first.
Resume prompt is injected from the disk artifact.
Compaction is token hygiene, not the source of continuity.
```

## Why this approach is better for continuous coding

Pi Session Continuity is not trying to be magical or invisible. It is intentionally explicit:

- **Recoverable:** the important state is in a local Markdown artifact that can be inspected, archived, copied, or used by a future Pi session.
- **Auditable:** every handoff records task, done criteria, constraints, files, validation evidence, open questions, and next actions in a stable structure.
- **Safer than memory-only continuation:** the resume prompt is generated from the artifact on disk, so continuity does not depend on the agent remembering what it meant to say.
- **Compatible with compaction:** compaction remains useful, but it is no longer the source of truth for continuity.
- **Good for unattended work:** if a long task reaches a context threshold, the package can create a visible handoff instead of silently drifting or truncating the useful state.

The result is a conservative infrastructure layer for extended Pi sessions: less clever, more durable, and easier to debug.

## Installation

Recommended install from npm:

```bash
pi install npm:pi-session-continuity
```

Pinned GitHub install:

```bash
pi install git:github.com/bernardofortes/pi-session-continuity@v0.1.1
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
  "triggerAtPercent": 70,
  "keepRecentPercent": 20,
  "synthesisModel": "inherit",
  "synthesisEffort": "medium",
  "artifactDirectory": "session-continuity"
}
```

`synthesisEffort` controls Continuity Brief synthesis reasoning/thinking level and accepts `inherit`, `minimal`, `low`, `medium`, `high`, or `xhigh`. `artifactDirectory` resolves under `<workspace>/<CONFIG_DIR_NAME>/` unless absolute. Invalid config disables automatic behavior and reports the config path.

In interactive Pi sessions, `/continuity settings` can update this file for the public config fields. In non-interactive contexts, edit the JSON directly or run `/continuity settings` for textual inspection.

### Native Pi auto-compaction

Pi native auto-compaction is enabled by default. When Pi Session Continuity automatic behavior is enabled, the package warns on session load if native Pi auto-compaction is still enabled because both systems can compete near the same context threshold.

Recommended project-local Pi setting:

```json
{
  "compaction": {
    "enabled": false
  }
}
```

Save that in `<workspace>/<CONFIG_DIR_NAME>/settings.json` (normally `.pi/settings.json`). Pi Session Continuity does not change this setting automatically during install or load.

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

`npm run smoke:manual` prints a checklist template for the required clean Pi smoke assertions. The checklist must be executed from a clean Pi install pinned to a GitHub ref before public announcement. Record the Pi version, Node version, OS, install command, smoke transcript, and resulting artifact path.

External validation commands such as `pi install git:github.com/bernardofortes/pi-session-continuity@v0.1.1`, git tags, releases, npm publishing, or uploads require separate explicit human approval.

## Known limitations in v0.1.0

- Local Pi sessions only.
- No user-facing cleanup command.
- No cross-machine sync or cloud storage.
- GitHub clean-install smoke is required before public announcement.
- npm is the recommended public install path after the tagged release passes smoke validation.

## Troubleshooting

- Invalid config: fix the JSON at the reported path; automatic behavior stays disabled until corrected.
- Synthesis failure: no resume prompt is queued; inspect the failed artifact path if one was written.
- Write failure: no resume prompt is queued; fix filesystem permissions or artifact path.
- Stale pending artifact: `/continuity status` reports it as inert; v0.1.0 will not silently inject it after reload.
- Native Pi auto-compaction warning: add project-local Pi settings with `compaction.enabled=false` if Pi Session Continuity should own automatic threshold handoffs. Manual `/compact` remains available.
- Untrusted project: trust the project before relying on project-local config or automatic behavior.

## Update / uninstall

```bash
pi update --extension npm:pi-session-continuity
pi remove npm:pi-session-continuity

# For pinned GitHub installs:
pi update --extension git:github.com/bernardofortes/pi-session-continuity@v0.1.1
pi remove git:github.com/bernardofortes/pi-session-continuity
```

Removing the package stops loading the extension. Existing local artifacts remain on disk unless you remove them manually.

## Compatibility

Developed against Pi CLI/package APIs from `@earendil-works/pi-coding-agent` 0.80.x, Node.js 22, and Linux. Record exact Pi version, OS, install command, and smoke transcript before tagging a public release.
