# Project configuration

Every entry in `projects.config.json` has six required fields:

```json
{
  "id": "site-a",
  "tokenFile": "token-definitions/projects/site-a/tokens.json",
  "outputDir": "dist/site-a",
  "packageName": "@ekinotech/design-tokens-site-a",
  "version": "1.2.0",
  "documentationSlug": "site-a",
  "enabled": true
}
```

- `id`: unique lowercase kebab-case ID.
- `tokenFile`: safe repository-relative path ending in `/tokens.json`.
- `outputDir`: safe repository-relative generated root. Project outputs must not overlap.
- `packageName`: unique and exactly `@ekinotech/design-tokens-<project-id>`.
- `version`: required stable SemVer for that project's next tag, package, ZIP, and changelog section.
- `documentationSlug`: unique lowercase kebab-case documentation ID.
- `enabled`: boolean build and release state.

An enabled project must have its canonical token file. If canonical data is not ready, set `enabled` to `false` and add a non-empty `disabledReason`:

```json
{
  "id": "site-b",
  "tokenFile": "token-definitions/projects/site-b/tokens.json",
  "outputDir": "dist/site-b",
  "packageName": "@ekinotech/design-tokens-site-b",
  "version": "1.0.0",
  "documentationSlug": "site-b",
  "enabled": false,
  "disabledReason": "Canonical tokens.json has not been reviewed yet."
}
```

Broad builds exclude disabled projects. An explicit build or release fails with the reason. Do not restore old client data from Git history to make a project pass.

Target repositories, credentials, destination paths, Theme choices, and versions do not belong here. Theme data comes from canonical `$themes`; a project-output version is a build argument.
