# CI/CD operations

## Pull-request validation

`.github/workflows/token-ci.yml` runs when source tokens, configuration, scripts, tests, package metadata, or the workflow itself changes. It:

1. installs with Node 22 and `npm ci`;
2. runs unit and contract tests;
3. runs TypeScript typecheck;
4. detects affected token projects for pull requests;
5. validates current canonical token files;
6. builds artifacts;
7. uploads `dist/` as the `token-dist` workflow artifact.

A green workflow proves the checked-in inputs can be validated and built. It does not prove a real target PR, deployment preview, or Figma runtime behavior.

## Target delivery

`.github/workflows/target-delivery.yml` runs after relevant changes reach `main`, or by manual dispatch. Push runs detect affected projects, build artifacts, and invoke delivery in apply mode. Manual dispatch can select one project and defaults to dry-run.

Apply mode requires `TARGET_REPOSITORY_TOKEN` with permission to create branches, commits, and pull requests in the configured target repository. Delivery proposes a PR; it never merges directly into the target base branch.

## Local release evidence

Run:

```sh
npm ci
npm test
npm run typecheck
npm run validate:tokens
npm run build:artifacts
npm run delivery:target-mr
npm audit
```

The delivery command is dry-run unless apply is explicitly authorized. Keep the output from all commands in the release PR or linked CI run.

## Security audit handling

An audit finding is not equivalent to an exploitable production issue, but it must be triaged. Record:

- affected direct and transitive packages;
- whether the dependency runs only during trusted builds;
- whether untrusted token content reaches the vulnerable API;
- the available fixed version and compatibility impact;
- the accepted mitigation and review date.

Do not use `npm audit fix --force` on the release branch without rebuilding artifacts and reviewing output changes. The current `@tokens-studio/sd-transforms` upgrade path is a compatibility change and needs a dedicated test PR.

## Rollback

Generated files are deterministic. Roll back through a corrective PR that restores the prior canonical/config revision, rebuilds, and creates a new target PR. Do not manually patch generated CSS in the target because the next delivery replaces it.
