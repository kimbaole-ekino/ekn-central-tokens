# Consumer integration

Configure the `@ekinotech` scope for GitHub Packages with the consumer's normal read-package credentials, then install the exact project version:

```sh
npm install --save-exact @ekinotech/design-tokens-<project-id>@<version>
```

For local smoke testing, Central can create a temporary archive:

```sh
npm run build:packages -- --project=<project-id>
npm install ./dist/<project-id>/packages/design-tokens-<project-id>-v<version>.tgz
```

The matching GitHub Release provides:

```text
design-tokens-<project-id>-v<version>.zip
```

The ZIP is a review and download bundle with the package directory, Storybook, build information, and checksums. The npm package remains the installable distribution.

Import one or more explicit CSS exports listed in the installed `package.json`, then set `data-color-scheme` on the root or a scoped block. The consumer owns cascade order when several Theme Group files are loaded.

Run application tests after changing the installed version. Central does not change a consumer repository.
