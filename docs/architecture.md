# Architecture

## System boundary

Token Architect authors canonical files. Central consumes those files and produces artifacts. Target applications consume delivered CSS. No downstream layer is allowed to invent a different Set/Theme/alias resolver.

`@eknvn/token-validator` is the semantic authority shared with the plugin. Central owns orchestration concerns: project selection, repository-safe paths, permutation bounds, transformed-name collisions, deterministic filenames/manifests, and delivery planning.

## Build stages

1. Read `projects.config.json` and optionally filter selected project IDs.
2. Read raw token text with duplicate-key detection.
3. Validate the canonical document with the submission profile.
4. Derive one Theme per canonical group for every permutation, ordered by first group appearance in `$themes`.
5. Resolve the effective graph for each context, including provenance and alias targets.
6. Feed resolved leaves through Style Dictionary and Tokens Studio transforms for names/types.
7. Emit flat one-group or nested multi-group CSS, resolved JSON, and a manifest into the configured central output directory.
8. Validate `targets.config.json`, plan only configured artifact mappings, and prepare a target PR.

## Trust and failure model

Every boundary fails closed. Missing files, unsafe relative paths, duplicate project IDs, invalid canonical data, too many permutations, normalized filename collisions, transformed custom-property collisions, missing manifest entries, and overlapping target destinations abort before delivery.

The build removes and recreates only the validated project output directory. It cannot write outside the repository. Delivery uses a worktree/target checkout and copies only mapped extensions or files.

## Artifact roles

CSS is the consumer contract. Resolved JSON is a central diagnostic view useful for comparing effective values. `manifest.json` records context-to-path mapping and is the delivery planner's evidence. Current targets map CSS only, so JSON and the manifest never enter target PRs.

## Alias representation

The effective graph resolves values for correctness. The CSS adapter then restores a simple direct alias as `var(--target-name)` after Style Dictionary has assigned collision-checked names. JSON stays resolved. This hybrid preserves runtime CSS relationships without asking target projects to understand canonical token semantics.
