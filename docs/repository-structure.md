# Repository Structure

This repository is the central source/build/delivery boundary for design
tokens.

## Current Structure

```text
ekn-central-tokens/
  token-definitions/
    projects/
      project-a/
        tokens.json
      project-b/
        tokens.json

  blocks/
    pools/
      core/
        button/
          block.json
          schema.json
          examples.json
          template.html
        hero/
          block.json
          schema.json
          examples.json
          template.html

  scripts/
    token-build-utils.mjs
    validate-token-projects.mjs
    build-token-artifacts.mjs
    check-stale-token-pr.mjs
    create-target-merge-requests.mjs

  projects.config.json
  targets.config.json
  .github/workflows/
  docs/
```

## Ownership

| Path | Owner | Purpose |
| --- | --- | --- |
| `token-definitions/` | Figma plugin output, central repo review | Canonical plugin-submitted token source files. |
| `projects.config.json` | Central token repo | Project build matrix and source/output paths. |
| `blocks/` | Central token repo | Static HTML block contracts and examples. |
| `scripts/` | Central token repo | Validation, build, stale check, and target PR/MR delivery scripts. |
| `targets.config.json` | Central token repo | Target project delivery destinations. |
| `.github/workflows/` | Central token repo | CI and manual target delivery workflows. |
| `dist/` | Generated | Build output. Ignored by Git. |

`projects.config.json` and `targets.config.json` may be committed before a new
project's `tokens.json` exists. The first Figma plugin sync creates that token
file through a reviewed PR/MR.

## Token Source Contract

Each normal project has one plugin-submitted token document:

```text
tokens.json
```

`tokens.json` is the canonical token source. It must contain token sets,
`$themes`, `$metadata`, and optional `$extensions`.

Token leaves use:

```json
{
  "type": "color",
  "value": "#ffffff",
  "description": "optional"
}
```

Allowed metadata:

```text
$themes
$metadata
$extensions
```

Stable token IDs live under:

```text
$extensions.ekinoTokenArchitect.id
```

## Provider Input Boundary

The Figma plugin submits changes to this repository through a provider-backed
GitHub PR. This repository does not store provider credentials and does not own
the plugin runtime.

Expected provider output:

```text
Changed token file: token-definitions/projects/{project}/tokens.json
Branch: tokens/figma-...
PR into the central repo default branch
```
