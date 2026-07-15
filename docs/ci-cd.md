# CI/CD operations

## Pull-request checks

`.github/workflows/token-ci.yml` runs when token source, config, scripts, tests, package files, or the workflow changes. It:

1. installs packages with Node 22 and `npm ci`;
2. runs tests and TypeScript checks;
3. finds affected token projects;
4. validates affected canonical files, including files without project config;
5. builds registered projects that have `tokens.json`;
6. uploads `dist/` as the `token-dist` CI artifact.

A green run means the checked files are valid and all ready projects can build. It does not prove a real target pull request or Figma runtime behavior.

## Target delivery

`.github/workflows/target-delivery.yml` runs after related changes reach `main`, or through a manual run. A push to `main` finds affected projects, builds them, and can use apply mode. A manual run can select one project and starts as a dry-run.

Apply mode needs `TARGET_REPOSITORY_TOKEN`. The token must be able to create branches, commits, and pull requests in the target repository. Delivery never merges into the target base branch.

## Local release checks

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

The delivery command is a dry-run unless apply mode is clearly enabled. Add command output or a CI link to the release pull request.

## Security audit results

For each audit issue, record:

- direct and indirect packages;
- whether the package only runs during trusted builds;
- whether token input reaches the unsafe code;
- the fixed version and change risk;
- the chosen safety step and next review date.

Do not run `npm audit fix --force` on a release branch without building again and checking output changes.

## Rollback

Restore the last good token or config state through a new pull request. Build again and create a new target pull request. Do not edit generated target CSS by hand.
