# Affected Project CI

This note records the scalable CI decision for central token pull requests. It
is the source of truth for affected-project detection rules. `ci-cd.md` only
summarizes how CI uses this behavior.

## Decision

Central token CI should not build every configured project for every token PR.

The correct default is:

```text
PR changes project-c tokens
-> validate repository config
-> validate token documents
-> build project-c artifacts only
-> upload project-c temporary PR artifacts
central PR merges to main
-> rebuild project-c from merged main
-> create or update project-c target PR/MR
```

Building all projects is only required when the change can affect all project
outputs.

## Why

Building all projects is acceptable for early scaffolding, but it does not scale.
With 100 or 1000 projects, a single project token update would waste CI time,
increase artifact noise, and make maintainer review harder.

The central repo still keeps CI as the final authority, but the artifact build
scope should match the change scope.

## Detection Rules

Affected-project detection uses changed file paths and config diffs:

| Change | Build scope |
| --- | --- |
| `token-definitions/projects/{project-id}/tokens.json` | That project only. |
| New project added to `projects.config.json` | That project only. |
| Existing project config changed | That project only. |
| Target config changed in `targets.config.json` | That target project only. |
| `scripts/**`, `package.json`, `package-lock.json`, CI workflow changed | All projects. |
| Manual workflow dispatch without an affected base ref | All projects. |
| Base/head commit unavailable in the local checkout | All projects. |

HTML block pool detection is a beta feature. When a changed file is under a
configured `blocks/pools/{pool}` directory, CI maps the change back to projects
that list that pool in `projects.config.json`.

## First Sync Behavior

If `project-c` is configured but its `tokens.json` has not been created by the
Figma plugin yet:

```text
validate: project-c config is checked
build: project-c is selected, then skipped because tokens.json does not exist
delivery: project-c is selected, then skipped because no artifact exists yet
```

This is valid for config-only onboarding PRs. The first plugin PR/MR that
creates `token-definitions/projects/project-c/tokens.json` will build
`project-c`.

## Missing Git Refs

Affected-project detection requires both the base and head commits to be
available in the checkout. If either ref is missing, the detector must not fail
the workflow. It falls back to all configured projects so CI stays conservative:

```text
Base ref {sha} is not available locally; falling back to all token projects.
Affected token projects: project-a, project-b, project-c
```

This can happen locally when testing against SHAs that are not in the clone, or
in CI when an event provides a zero/expired commit reference.

## Current Implementation

- `scripts/detect-affected-token-projects.ts` detects affected project IDs.
- `.github/workflows/token-ci.yml` runs the detector for pull requests.
- `.github/workflows/target-delivery.yml` runs the detector after pushes to
  `main`.
- The detector writes `TOKEN_PROJECTS` for build filtering.
- The detector writes `TARGET_DELIVERY_PROJECTS` for target delivery filtering.
- `scripts/build-token-artifacts.ts` respects `TOKEN_PROJECTS`,
  `--project=...`, and `--projects=...`.
- `scripts/create-target-merge-requests.ts` respects
  `TARGET_DELIVERY_PROJECTS`, `--project=...`, and `--projects=...`.

Local full validation still builds all projects by default:

```bash
npm run validate
```

Targeted local validation can be run with:

```bash
TOKEN_PROJECTS=project-c npm run build:artifacts
TARGET_DELIVERY_PROJECTS=project-c npm run delivery:target-mr
```
