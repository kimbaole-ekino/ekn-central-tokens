# Project-output release workflow

Each target project versions and releases independently.

1. Set the reviewed stable version in `projects.config.json`.
2. Add a non-empty `## <version>` section to the `CHANGELOG.md` beside that project's `tokens.json`.
3. Merge the reviewed change into `main`.
4. Create `<project-id>-v<version>` in GitHub or push that tag with Git.

The tag workflow verifies that the project exists, is enabled, and has the same configured version. It installs the Validator from GitLab, runs validation, builds only that project, publishes `@ekinotech/design-tokens-<project-id>@<version>` to GitHub Packages, and creates the matching GitHub Release with:

```text
design-tokens-<project-id>-v<version>.zip
```

The changelog section is the GitHub Release description. The ZIP contains the matching package directory, Storybook, build information, and checksums.

The workflow does not release Central tooling, publish the Validator, create a version or tag, run through manual dispatch, or deliver files to a target repository.
