# Central Tokens documentation

This documentation describes the implemented central pipeline and its boundary with Token Architect and target applications.

- [Architecture](architecture.md) — ownership, trust boundaries, stages, and invariants.
- [Project configuration](project-configuration.md) — complete `projects.config.json` field and validation reference.
- [Configuration examples](configuration-examples.md) — project registration and target delivery walkthroughs.
- [Theme contexts](theme-combinations.md) — canonical derivation, order, and the internal safety limit.
- [Nested artifacts](nested-artifacts.md) — output IDs, paths, selectors, JSON, manifest, and collisions.
- [Artifact contract](artifact-contract.md) — target-facing selector, alias, path, and delivery contract.
- [Target delivery](target-delivery.md) — complete `targets.config.json` reference, path mapping, dry-run/apply behavior, and troubleshooting.
- [Developer guide](developer-guide.md) — setup, change workflow, and common implementation tasks.
- [Maintainer guide](maintainer-guide.md) — review contracts, project onboarding, and release discipline.
- [CI/CD operations](ci-cd.md) — workflow triggers, delivery credentials, audit handling, and rollback.

## Responsibility summary

| Concern                                                    | Owner                                    |
| ---------------------------------------------------------- | ---------------------------------------- |
| Token values, aliases, Set order/states, Theme definitions | Designer through canonical `tokens.json` |
| Canonical semantics and diagnostics                        | `@eknvn/token-validator`                 |
| Project paths, build output, CSS destination               | Central developer configuration          |
| CSS/JSON/manifest generation                               | Central build                            |
| Internal JSON and manifest retention                       | Central CI/artifact store                |
| CSS review, integration, and merge                         | Target repository maintainer             |

The target does not need canonical/resolved JSON or the central manifest. Those remain central unless a destination is explicitly configured; current targets configure CSS only.
