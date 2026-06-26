# CI/CD

CI is the final validation and build authority for token changes.

The Figma plugin may validate early, but this repository decides whether a token
change can be merged and delivered.

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/token-ci.yml` | Pull request, manual dispatch | Validate token sources and build artifacts. |
| `.github/workflows/target-delivery.yml` | Manual dispatch | Build artifacts and create target project PRs/MRs when apply mode is selected. |

Both workflows run `npm ci` before repository scripts so CI uses the locked
`style-dictionary` dependency from `package-lock.json`.

## Pull Request Flow

```text
1. Figma plugin creates a branch and PR.
2. CI validates token files.
3. CI checks stale token baseline state when SHA inputs are available.
4. CI builds generated artifacts.
5. CI uploads `dist/` as an artifact.
6. Maintainer reviews token source and generated artifact output.
7. PR is merged only after checks pass.
```

## Build Timing

PR build is a validation gate only:

- validate `tokens.json`,
- validate `projects.config.json` and `targets.config.json`,
- prove Style Dictionary can build the project,
- optionally upload `dist/` as a temporary workflow artifact.

The PR build output is not the durable release artifact and is not pushed to
target projects.

The durable build/delivery boundary starts after merge to `main`:

```text
token PR merged into main
-> build artifacts from merged main
-> target delivery workflow creates target project PR/MR
-> target maintainer reviews and merges
```

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

`build:artifacts` delegates token processing to the Style Dictionary build
boundary:

```bash
npm run build:style-dictionary
```

Expected output:

```text
Validated 2 token project(s).
Skipping stale token PR check: BASELINE_TOKEN_FILE_SHA and LATEST_TOKEN_FILE_SHA are not both set.
Built project-a into dist/project-a
Built project-b into dist/project-b
Target delivery MR for project-a
Mode: dry-run
Target delivery MR for project-b
Mode: dry-run
```

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

In that pre-first-sync state:

- `npm run validate:tokens` validates the project and target configuration,
- missing `tokenFile` paths are reported as pending first sync,
- missing `tokenFile` paths do not fail token validation,
- `npm run build:artifacts` skips the pending project because there is no
  token source to build yet,
- `npm run delivery:target-mr` skips target delivery for the pending project
  because no built artifact can exist yet.

Expected pre-first-sync output:

```text
Skipping {project}: token-definitions/projects/{project}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
Validated 2 token file(s); 1 pending first sync project(s).
Skipping build for {project}: token-definitions/projects/{project}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
Skipping target delivery for {project}: token-definitions/projects/{project}/tokens.json does not exist yet. It will be created by the first plugin PR/MR.
```

## Future CI Improvements

- Inject real baseline/latest token file SHAs into the workflow.
- Add affected-project detection.
- Add block example schema validation.
- Add artifact snapshot checks.
- Add deterministic versioning from commit SHA.
