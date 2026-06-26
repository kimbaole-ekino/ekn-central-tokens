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
| `generated-artifacts.md` | Generated CSS, metadata JSON, static HTML, and manifest contract. |
| `release-workflow.md` | Review, merge, release, and artifact handoff flow. |
| `target-project-delivery.md` | Target project PR/MR delivery workflow and boundaries. |
| `target-mr-delivery-tracking.md` | Current implementation status, prerequisites, and follow-ups. |

## Out Of Scope

The following topics belong in the Figma plugin repository, not here:

- Figma plugin UI and runtime.
- Figma `manifest.json`.
- Figma `clientStorage`.
- GitHub PAT settings UI.
- Sync Review screen implementation.
- Figma Variables import UI/runtime.
- Product discovery notes and plugin authoring UX.
