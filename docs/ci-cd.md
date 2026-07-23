# CI and affected projects

`token-ci.yml` runs for pull requests and `main` pushes. It creates a temporary `.npmrc`, installs the exact Validator package from GitLab, removes the credentials file, validates affected projects, and builds temporary CSS, packages, and Storybook guides.

Direct changes under `token-definitions/projects/<id>/` select that project. Shared scripts, Storybook templates, package metadata, and lockfiles select all projects. A project config change selects entries that were added or changed. A missing base commit selects all projects safely.

An enabled project requires canonical data, a stable configured version, and a non-empty matching changelog section. Disabled projects are excluded from broad previews and fail when selected explicitly.

`release-project.yml` runs only for tags that match `<project-id>-v<version>`. It verifies the project and version, uses the matching project changelog section, runs checks, builds only that project, publishes its npm package to GitHub Packages, and creates a GitHub Release with its ZIP.

The release workflow has no manual dispatch, dry-run mode, version calculation, automatic version change, or automatic tag creation.

## GitHub repository settings

- Secret `GITLAB_NPM_TOKEN`: Validator Deploy Token with only `read_package_registry`.
- Variable `GITLAB_HOST`: GitLab host name without a protocol or path.
- Variable `VALIDATOR_PROJECT_ID`: numeric GitLab project ID for `design-token-pipeline`, which publishes the Validator workspace.

The `design-token-pipeline` GitLab project must allow this Deploy Token to read its Package Registry. Workflows create and remove `.npmrc`; credentials are not committed.
