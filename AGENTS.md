# AGENTS.md — Pi Session Continuity

## Project Identity

This repository is **Pi Session Continuity**, a public Pi package/extension project.

Primary source of truth:

- `docs/product-spec.md`

The product provides durable, explicit session continuity for long-running Pi work by writing a disk-backed **Continuity Brief** before queuing any resume prompt.

## Read This First

Before implementing, reviewing, or changing behavior, read `docs/product-spec.md`. Treat it as the authoritative product contract.

If this file and `docs/product-spec.md` conflict, follow `docs/product-spec.md` and update this file only after the product spec has been intentionally changed.

## Core Invariant

Do not violate this invariant:

```text
Durable Continuity Brief first.
Resume prompt is injected from the disk artifact.
Compaction is token hygiene, not the source of continuity.
```

Implementation consequences:

- Write and validate the Continuity Brief before queuing a resume prompt.
- Read the queued resume prompt from the saved artifact on disk; do not regenerate it from memory.
- If synthesis, validation, or artifact writing fails, queue no resume prompt.
- Native Pi compaction may happen only as token hygiene after the durable artifact/resume path is safe.
- Failed artifacts are postmortems only and must never become resume input.

## Product Boundaries

For v0/v0.1.0, do **not** add:

- loop, campaign, or episode concepts;
- AGENTS.md rewriting behavior;
- invisible continuation;
- compaction-proof as a continuity source;
- cleanup commands;
- npm publishing automation;
- GitHub/release/publish actions without explicit human approval.

The extension is general session-continuity infrastructure. If the current user work is a loop, campaign, migration, or multi-step run, describe it naturally in the Continuity Brief; do not encode loop-specific concepts into product code, config, schema, commands, or status messages.

## Implementation Target

The public package must become a GitHub-installable Pi package.

Expected v0.1.0 package shape is defined in `docs/product-spec.md`, including:

- `package.json` Pi manifest;
- `keywords` including `pi-package`;
- extension entrypoint under `extensions/session-continuity/index.ts`;
- runtime/development dependency placement;
- README, LICENSE, CHANGELOG, tests, and smoke scripts.

Do not invent a different layout unless the product spec is changed first.

## Configuration Contract

The v0.1.0 config source of truth is project-local:

```text
<workspace>/<CONFIG_DIR_NAME>/session-continuity.json
```

Rules:

- Use `CONFIG_DIR_NAME` from `@earendil-works/pi-coding-agent`; do not hardcode `.pi` internally.
- Read project-local config only when `ctx.isProjectTrusted()` is true.
- Invalid config must fail loudly, report the path, and disable automatic behavior until corrected.
- `artifactDirectory` resolves under `<workspace>/<CONFIG_DIR_NAME>/` unless absolute.

## Pi API Integration Expectations

Use explicit Pi extension APIs as specified:

- Register command namespace `/continuity` and dispatch subcommands from args.
- Support `/continuity status`, `/continuity checkpoint`, and `/continuity settings` for v0.1.0.
- Use `session_start` for session-scoped state and stale artifact inspection.
- Use a low-risk post-turn event such as `turn_end` for threshold checks.
- Use `ctx.getContextUsage()` and active model context metadata for trigger math.
- Use `ctx.sessionManager` for session id, session file, branch, and leaf identity.
- Use Pi model registry/auth APIs for `synthesisModel` resolution.
- Queue resume prompts with `pi.sendUserMessage()` only after the artifact has been written and re-read from disk.
- When the agent is busy, use the documented non-interrupting delivery mode, normally `deliverAs: "followUp"`.
- Use `ctx.compact()` only after the artifact/resume path is safe.
- Do not start long-lived timers, watchers, sockets, or background processes from the extension factory.

## Artifact Contract

Continuity Brief artifacts are session-scoped and must follow `docs/product-spec.md`:

```text
<artifactDirectory>/<sessionId>/pending/<eventId>.md
<artifactDirectory>/<sessionId>/archive/<timestamp>-<eventId>.md
<artifactDirectory>/<sessionId>/failed/<timestamp>-<eventId>.md
<artifactDirectory>/<sessionId>/lock/<eventId>.json
```

Important rules:

- Artifacts from other sessions are inert.
- Same-session stale pending artifacts are inert after reload unless an explicit future recovery command says otherwise.
- Successful handoffs archive after the resume prompt is queued from disk.
- Status messages must show concrete resolved paths, not only directories.
- Failed artifacts must be rejected by the resume-prompt path even if their body looks useful.

## Validation Requirements

Before claiming work is done, run the checks that prove the affected behavior.

Minimum product gates for implementation/release work:

```bash
npm test
npm run typecheck
npm pack --dry-run
```

Public release readiness also requires clean Pi install/smoke validation from a GitHub ref, as defined in `docs/product-spec.md`.

For behavior changes, add or update tests for the relevant contract, especially:

- config validation;
- threshold percentage math;
- artifact path/session isolation;
- frontmatter and mandatory heading validation;
- stale artifact inertness;
- cross-session rejection;
- single-flight duplicate suppression;
- synthesis/write failure queues no prompt;
- resume prompt uses disk artifact exactly;
- directive-looking transcript/tool/file content is evidence, not authority.

## Security and External Mutation

This project is intended to be public, but external actions still require explicit human approval.

Do not perform without approval:

- creating, deleting, or changing GitHub repositories;
- pushing commits or tags;
- creating releases;
- publishing to npm;
- uploading artifacts;
- mutating external systems.

Public docs must warn that Pi packages execute with local user permissions and that Continuity Briefs may contain sensitive session context. v0.1.0 does not guarantee secret redaction.

## Documentation Expectations

Public announcement is not ready until the repo includes user-facing docs required by `docs/product-spec.md`:

- README with install, quick start, commands, config, artifact layout, privacy/security, known limitations, troubleshooting, update/uninstall, and compatibility;
- CHANGELOG with v0.1.0 notes;
- MIT LICENSE text.

Do not treat the product spec alone as sufficient public collateral.

## Working Style for Agents

- Keep changes small and traceable.
- Prefer changing the product spec first when behavior, package contract, validation policy, or public release expectations change.
- Do not preserve parallel old/new behavior unless the spec explicitly requires compatibility.
- Do not add broad abstractions or release machinery before v0.1.0 needs them.
- Anchor claims to files, commands, tests, or Pi docs.
- If the Pi API behavior is uncertain, read the local Pi documentation under `/home/ubuntu/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs` before coding.
