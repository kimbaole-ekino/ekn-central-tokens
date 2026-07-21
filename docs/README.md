# Central Tokens documentation

These guides describe only the current Central pipeline: configuration, validation integration, builds, artifacts, CI, and target delivery.

For the complete product boundary and designer-to-target process, read the [overall architecture](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/project/architecture.md) and [end-to-end workflow](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/project/end-to-end-workflow.md). For exact token semantics, read the [validator documentation](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/tree/main/packages/token-validator/docs).

- [Architecture](architecture.md) — owners, main steps, and safety rules.
- [Project configuration](project-configuration.md) — all fields in `projects.config.json`.
- [Configuration examples](configuration-examples.md) — steps to add and deliver a project.
- [Theme contexts](theme-combinations.md) — Theme Groups, combinations, and order.
- [Nested artifacts](nested-artifacts.md) — output names, paths, selectors, JSON, and the manifest.
- [Artifact contract](artifact-contract.md) — the files and CSS rules used by targets.
- [Target delivery](target-delivery.md) — all fields in `targets.config.json` and the delivery process.
- [Developer guide](developer-guide.md) — setup and common development work.
- [Maintainer guide](maintainer-guide.md) — review, onboarding, and release checks.
- [CI/CD operations](ci-cd.md) — CI runs, delivery access, security checks, and rollback.

## Who owns each part

| Part                                              | Owner                           |
| ------------------------------------------------- | ------------------------------- |
| Canonical token input                             | Reviewed `tokens.json`          |
| Shared token semantics used by Central            | `@eknvn/token-validator`        |
| Project paths, build output, and CSS destinations | Central configuration           |
| CSS, resolved JSON, and manifest creation         | Central build                   |
| Stored JSON and manifest build evidence           | Central CI and artifact storage |
| CSS use, app tests, review, and merge             | Target maintainer               |

A target receives only the artifact types with exact destinations. For example, a CSS-only destination keeps resolved JSON and the manifest in Central.
