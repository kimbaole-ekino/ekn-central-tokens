# Developer guide

## Validator package access

The exact `@ekinotech/design-token-validator` version is in `package.json`. Copy `.npmrc.example`, replace the GitLab host and `design-token-pipeline` project ID, then provide `GITLAB_NPM_TOKEN`.

The token needs read-only access to the Validator Package Registry. The scope rule must route only `@ekinotech` to GitLab during dependency installation. Do not commit `.npmrc`.

For temporary integration testing before the package is available, use a local `npm pack` without saving it to `package.json` or `package-lock.json`. Do not keep a tarball fallback.

## Focused project work

```sh
npm run validate:tokens -- --project=<enabled-project-id>
npm run build:packages -- --project=<enabled-project-id>
npm run build:storybook -- --project=<enabled-project-id>
npm run storybook -- --project=<enabled-project-id>
```

These commands use the project's configured version when `--version` is omitted. Do not edit `dist/` or generated package metadata by hand.
