# Design Token Central

Central is the GitHub repository that validates canonical token projects and creates isolated CSS packages and static Storybook guides. It never changes a target repository.

```text
GitHub Sync from the Figma Plugin
  -> tokens.json
  -> @ekinotech/design-token-validator from GitLab
  -> affected-project validation
  -> dist/<project-id>/raw
  -> @ekinotech/design-tokens-<project-id> package
  -> static Storybook
  -> GitHub Packages npm publication
  -> project ZIP in a GitHub Release
  -> consumer-controlled install
```

## Setup and checks

Use Node 22. Central pins an exact Validator version in `package.json`. For local work, copy `.npmrc.example`, replace its placeholders, and provide a GitLab token that can read the Validator Package Registry.

```sh
npm ci
npm test
npm run typecheck
npm run validate:tokens
npm run build:artifacts
npm run build:packages
npm run build:storybook
```

The Validator package is consumed directly from GitLab. Central does not download Validator release assets, keep a local tarball fallback, or republish the Validator to GitHub Packages.

Central is private and uses its commit SHA for traceability. Each target project stores its own stable version in `projects.config.json`. Creating `<project-id>-v<version>` publishes only that project's npm package and ZIP.

`havas-network-websites` is disabled because its canonical `tokens.json` is not present. Disabled projects are excluded from broad builds, and an explicit build or release fails with the configured reason.

Start with the [documentation index](docs/README.md), [project packages](docs/project-packages.md), and [release workflow](docs/release-workflows.md).
