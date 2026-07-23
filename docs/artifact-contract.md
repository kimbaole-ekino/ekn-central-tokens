# Artifact contract

`raw/` contains generated CSS, resolved JSON, and the build manifest. Resolved JSON is internal and is not included in the consumer package.

One Theme Group creates flat files such as `light.css`. Several Theme Groups create nested paths such as `brand/light.css`. CSS supports both root and scoped selectors:

```css
:root[data-color-scheme="brand-light"],
[data-color-scheme="brand-light"] {
}
```

`package/` contains CSS, README, `project-build.json`, and a generated `package.json` with explicit CSS exports. `packages/` contains only the local `.tgz`. `storybook-static/` contains the static guide and its `project-build.json`.

For a project-output release, `artifacts/` contains:

```text
design-tokens-<project-id>-v<version>.tgz
design-tokens-<project-id>-v<version>.zip
release-notes.md
```

The `.tgz` is published through GitHub Packages. Only the `.zip` is uploaded as a custom GitHub Release asset. The local `artifacts/release-notes.md` records the archive names and hashes. The GitHub Release description comes from the matching project changelog section in `release-metadata/release-notes.md`. Neither notes file is uploaded as an asset.

The full ZIP contains:

```text
package/
storybook/
BUILD_INFO.json
checksums.txt
```

The `.tgz` is directly installable and never contains Storybook. `BUILD_INFO.json` records the project, output version and tag, Central version and commit, Validator version, CSS outputs, and Themes. `checksums.txt` covers the files inside the ZIP.

Builds reject unsafe paths, output collisions, unresolved diagnostics, missing CSS, and cross-project content. Enabled projects must have canonical data. Disabled projects need a reason and are excluded from broad builds. Rebuilds may replace `raw`, `package`, `packages`, and `storybook-static`; release assets are not overwritten.
