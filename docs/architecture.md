# Central architecture

Central remains on GitHub. It receives canonical `tokens.json` changes from the Plugin's GitHub Sync runtime and installs `@ekinotech/design-token-validator` directly from the `design-token-pipeline` project-level GitLab npm Package Registry.

Style Dictionary transforms the already resolved Validator graph. Storybook reads that same graph.

Each project owns an isolated tree:

```text
dist/<project-id>/
├── raw/
├── package/
├── storybook-static/
├── packages/
└── artifacts/
```

Each project has an independent version in `projects.config.json`. Generated packages and Storybook record that version, the Central commit SHA, and the installed Validator version.

Project-output tags use `<project-id>-v<version>`. A matching tag publishes `@ekinotech/design-tokens-<project-id>@<version>` to GitHub Packages and creates a GitHub Release with the matching ZIP. Central tooling itself has no GitHub Release or npm publication.

Pull requests and pushes to `main` validate and build temporary previews only. Central does not store target repository permissions, create target branches, or copy files into consumers.
