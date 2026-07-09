# Local v1 Readiness Report — Pi Session Continuity

Date: 2026-07-07
Status: Local v1 readiness candidate
Scope: Local validation only; no external install, tag, release, publish, push, upload, or repository mutation performed.

## Summary

Pi Session Continuity has local v0.1.0 readiness evidence across package shape, artifact/config behavior, manual checkpoint handoff, status/settings, automatic threshold triggering, compaction hygiene, tests/smoke collateral, and public documentation.

The product invariant remains intact:

```text
Durable Continuity Brief first.
Resume prompt is injected from the disk artifact.
Compaction is token hygiene, not the source of continuity.
```

## Episode evidence

| Episode | Status | Primary evidence |
| --- | --- | --- |
| EPN-0001 package skeleton | Done | `specforge/runs/RUN-0001/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0001-package-skeleton.md` |
| EPN-0002 core artifact engine | Done | `specforge/runs/RUN-0002/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0002-core-artifact-engine.md` |
| EPN-0003 manual checkpoint | Done | `specforge/runs/RUN-0003/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0003-manual-checkpoint.md` |
| EPN-0004 status/settings | Done | `specforge/runs/RUN-0004/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0004-status-settings.md` |
| EPN-0005 automatic threshold | Done | `specforge/runs/RUN-0005/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0005-automatic-threshold.md` |
| EPN-0006 compaction hygiene | Done | `specforge/runs/RUN-0006/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0006-compaction-hygiene.md` |
| EPN-0007 tests + smoke scripts | Done | `specforge/runs/RUN-0007/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0007-tests-smoke.md` |
| EPN-0008 public docs/release readiness | Done | `specforge/runs/RUN-0008/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0008-public-docs-release-readiness.md` |
| EPN-0009 dogfood hardening/local readiness | Done | `specforge/runs/RUN-0009/autonomous-loop-result.yaml`; `docs/deploys/deploy-2026-07-07-SCOPE-0009-dogfood-hardening-local-readiness.md` |

## Final local gates

Final RUN-0009 local gates:

- `npm test` — `CMD-0002`
- `npm run typecheck` — `CMD-0003`
- `npm run smoke:manual` — `CMD-0004`
- `npm pack --dry-run` — `CMD-0007`
- forbidden runtime terminology grep — `CMD-0008`
- final reviewer verdict — `specforge/runs/RUN-0009/subagents/JUDGE-0001.md` (PASS)

## Local capability coverage

- Package manifest: `package.json` declares `pi-session-continuity` v0.1.0, `pi-package` keyword, Pi extension entrypoint, scripts, peer/dev dependency placement, and packaged docs/scripts.
- Runtime entrypoint: `extensions/session-continuity/index.ts` registers `/continuity` and lifecycle hooks.
- Config: `src/config.ts` covers trusted-project loading, validation, percentage math, and artifact directory resolution.
- Artifact contract: `src/artifact.ts` covers frontmatter, mandatory headings, status transitions, resume prompt rejection for non-pending artifacts, and directive-looking content boundaries.
- Handoff: `src/handoff.ts` writes/re-reads disk artifacts before queueing prompts, suppresses duplicates, archives after queue, and treats compaction as post-safe-path hygiene.
- Status/settings: `src/status.ts` reports complete status/settings fields and stale same-session pending artifacts.
- Automatic threshold: `src/trigger.ts` provides pure trigger decisions for disabled/untrusted/invalid/unavailable/below-threshold/threshold-reached states.
- Tests: `test/*.test.ts` cover local product gates, including package/docs/smoke collateral.
- Smoke template: `scripts/smoke/manual-checks.sh` lists all required manual Pi smoke assertions with PASS/FAIL fields.

## Deferrals and residual risks

External validation is intentionally not performed in this local readiness run. Before public tag or announcement, Bernardo must explicitly approve the external validation step and then run/record at least:

```bash
pi -e git:github.com/<owner>/pi-session-continuity@v0.1.0
pi install git:github.com/<owner>/pi-session-continuity@v0.1.0
```

Required clean-install smoke evidence remains:

- package loads from GitHub ref without local workspace paths;
- `/continuity status` appears and reports config state;
- `/continuity checkpoint` writes a valid artifact;
- resume prompt is queued from the exact saved artifact;
- invalid config and untrusted project behavior are explicit and safe;
- package removal works without manual code cleanup.

## Decision point

Local v1 readiness is accepted by RUN-0009 final gates and reviewer PASS. The next decision is whether Bernardo approves external clean-install/tag/release validation. No external action should happen without that separate approval.
