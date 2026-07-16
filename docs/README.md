# Central Tokens documentation

These guides describe the current Central pipeline. They also explain how Central works with Token Architect and target apps.

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

| Part                                                        | Owner                           |
| ----------------------------------------------------------- | ------------------------------- |
| Token values, references, Set order, Set states, and Themes | Designer through `tokens.json`  |
| Token rules and error messages                              | `@eknvn/token-validator`        |
| Project paths, build output, and CSS destinations           | Central configuration           |
| CSS, resolved JSON, and manifest creation                   | Central build                   |
| Stored JSON and manifest build evidence                     | Central CI and artifact storage |
| CSS use, app tests, review, and merge                       | Target maintainer               |

Current targets receive CSS only. Resolved JSON and the manifest stay in Central unless a target has an exact destination for them.
