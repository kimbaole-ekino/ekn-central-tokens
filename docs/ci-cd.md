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

## Future CI Improvements

- Inject real baseline/latest token file SHAs into the workflow.
- Add affected-project detection.
- Add block example schema validation.
- Add artifact snapshot checks.
- Add deterministic versioning from commit SHA.
