# EKN Central Tokens Documentation

This documentation set describes the central token repository only.

This repo receives reviewed `tokens.json` changes from the Figma plugin through
the configured provider, validates them in CI, builds generated artifacts, and
creates target project PRs/MRs for maintainer review.

## Document Map

| File | Purpose |
| --- | --- |
| `repository-structure.md` | Source folders, config files, and ownership boundaries. |
| `ci-cd.md` | Pull request validation, stale checks, and build workflow. |
| `affected-project-ci.md` | Affected-project detection and scalable PR build policy. |
| `style-dictionary-build.md` | Official Style Dictionary build model and repository orchestration. |
| `generated-artifacts.md` | Generated CSS, resolved token JSON, metadata JSON, static HTML, and manifest contract. |
| `release-workflow.md` | Review, merge, release, and artifact handoff flow. |
| `target-project-delivery.md` | Target project PR/MR delivery workflow and boundaries. |

## Recommended Reading Order

For a new team member, read these files in this order:

1. `README.md`
2. `repository-structure.md`
3. `release-workflow.md`
4. `generated-artifacts.md`
5. `target-project-delivery.md`
6. `ci-cd.md`
7. `affected-project-ci.md`
8. `style-dictionary-build.md`

Role-based shortcuts:

- Central token maintainer: `repository-structure.md`, `ci-cd.md`, `affected-project-ci.md`, `generated-artifacts.md`.
- Target project developer: `generated-artifacts.md`, `target-project-delivery.md`.
- Plugin contributor: use this documentation only for the central repo boundary; plugin UI and runtime details belong in the plugin repo.

## Key Terms

- Token source: reviewed input under `token-definitions/`.
- Generated artifact: rebuildable output under `dist/`.
- Workflow artifact: temporary CI output used for review/debug.
- Target delivery: PR/MR created from this repo into a target project.
- First sync: a configured project whose `tokens.json` has not been created by the first plugin PR/MR yet.

## Out Of Scope

The following topics belong in the Figma plugin repository, not here:

- Figma plugin UI and runtime.
- Figma `manifest.json`.
- Figma `clientStorage`.
- GitHub PAT settings UI.
- Sync Review screen implementation.
- Figma Variables import UI/runtime.
- Product discovery notes and plugin authoring UX.
