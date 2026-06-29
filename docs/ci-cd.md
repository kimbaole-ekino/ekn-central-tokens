# CI/CD

CI is the final validation and build authority for token changes.

The Figma plugin may validate early, but this repository decides whether a token
change can be merged and delivered. This file describes workflow behavior;
affected-project detection rules are documented in `affected-project-ci.md`, and
target PR/MR delivery details are documented in `target-project-delivery.md`.

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/token-ci.yml` | Pull request, manual dispatch | Validate token sources and build artifacts. |
| `.github/workflows/target-delivery.yml` | Push to `main`, manual dispatch | Build affected artifacts and create target project PRs/MRs. |

Both workflows run `npm ci` before repository scripts so CI uses the locked
`style-dictionary` dependency from `package-lock.json`.

## Pull Request Flow

```text
1. Figma plugin creates a branch and PR.
2. CI validates token files.
3. CI checks stale token baseline state when SHA inputs are available.
4. CI detects affected token projects.
5. CI builds generated artifacts for affected projects.
6. CI uploads `dist/` as an artifact.
7. Maintainer reviews token source and generated artifact output.
8. PR is merged only after checks pass.
```

## Build Timing

PR build is a validation gate only:

- validate `tokens.json`,
- validate `projects.config.json` and `targets.config.json`,
- detect affected token projects,
- prove Style Dictionary can build the affected projects,
- optionally upload `dist/` as a temporary workflow artifact.

The PR build output is not the durable release artifact and is not pushed to
target projects.

The durable build/delivery boundary starts after merge to `main`:

```text
token PR merged into main
-> build artifacts from merged main
-> target delivery workflow detects affected projects
-> target delivery workflow creates target project PR/MR for affected projects
-> target maintainer reviews and merges
```

Manual target delivery can still be run from GitHub Actions. Its `dry_run`
input defaults to true, so manual runs validate and print delivery unless
`dry_run` is set to false.

Do not commit generated `dist/` output back to this repository as normal source.
`dist/` is rebuildable.

## Local Validation

Run:

```bash
npm run validate
```

This expands to:

```bash
npm run validate:tokens
npm run check:stale-token-pr
npm run build:artifacts
npm run delivery:target-mr
```

`build:artifacts` runs the Style Dictionary build boundary:

```bash
npm run build:style-dictionary
```

Expected output:

```text
Validated 2 token file(s); 1 pending first sync project(s).
Skipping stale token PR check: BASELINE_TOKEN_FILE_SHA and LATEST_TOKEN_FILE_SHA are not both set.
Built project-a into dist/project-a
Built project-b into dist/project-b
Target delivery MR for project-a
Mode: dry-run
Target delivery MR for project-b
Mode: dry-run
```

Pull request CI narrows the artifact build with affected-project detection.
See `affected-project-ci.md` for the full detection rules and fallback behavior.

## Stale PR Check

The stale check compares:

```text
BASELINE_TOKEN_FILE_SHA
LATEST_TOKEN_FILE_SHA
```

Passing example:

```bash
BASELINE_TOKEN_FILE_SHA=abc LATEST_TOKEN_FILE_SHA=abc npm run check:stale-token-pr
```

Expected output:

```text
Stale token PR check passed.
```

Failing example:

```bash
BASELINE_TOKEN_FILE_SHA=abc LATEST_TOKEN_FILE_SHA=def npm run check:stale-token-pr
```

Expected output:

```text
Token file changed after the plugin baseline was created.
Baseline file SHA: abc
Latest file SHA: def
Regenerate the review request from the latest repository state.
```

## Required CI Rules

CI should block merge on:

- invalid token source structure,
- missing token `type` or `value`,
- invalid path segments,
- duplicate stable token IDs,
- unresolved or cyclic aliases,
- failed artifact build,
- stale baseline mismatch when SHA inputs are present.

## First Sync Projects

A developer may register a new project in `projects.config.json` and
`targets.config.json` before the Figma plugin has created that project's
`tokens.json`.

In that pre-first-sync state, config validation still runs, but artifact build
and target delivery skip the project until the first plugin PR/MR creates the
token source file. See `repository-structure.md` for the first sync boundary and
`affected-project-ci.md` for the affected-project behavior.

Expected pre-first-sync output:

```text
Skipping {project-id}: token-definitions/projects/{project-id}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
Validated 2 token file(s); 1 pending first sync project(s).
Skipping build for {project-id}: token-definitions/projects/{project-id}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
Skipping target delivery for {project-id}: token-definitions/projects/{project-id}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
```

## Future CI Improvements

- Inject real baseline/latest token file SHAs into the workflow.
- Add block example schema validation.
- Add artifact snapshot checks.
- Add deterministic versioning from commit SHA.
