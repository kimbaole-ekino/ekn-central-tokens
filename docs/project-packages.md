# Project packages

Every project with canonical token data produces `@ekinotech/design-tokens-<project-id>` with its configured output version. `npm pack` creates:

```text
design-tokens-<project-id>-v<version>.tgz
```

The package contains only that project's CSS, README, and `project-build.json`. The build metadata records the Central version and commit, Validator version, project ID, package name, and output version. The package has explicit exports for each supported CSS file. It does not contain canonical `tokens.json`, resolved JSON, Central scripts, credentials, target configuration, or another project.

The version is independent from Central, Plugin, Validator, and other project outputs. The same version is injected into that project's Storybook metadata.

Install from GitHub Packages or use one local build:

```sh
npm install @ekinotech/design-tokens-<project-id>@<version>
```

```js
import "@ekinotech/design-tokens-<project-id>/<supported-export>.css";
```

The placeholders above show the contract only. The generated `package.json` is the source for supported CSS exports.

Integration tests install the archive in a clean temporary Node project, resolve exports, and inspect package isolation.
