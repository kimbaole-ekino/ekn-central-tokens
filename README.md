# EKN Central Tokens

Governed central repository for design-token source files, build logic,
generated artifact manifests, and target project merge-request delivery.

## Role

This repository is the reviewed source of truth for token delivery.

```text
Figma plugin -> GitHub PR -> central token repository CI -> generated artifacts -> target project PR/MR
```

The Figma plugin is the authoring surface. This repository owns validation,
build, and delivery governance. It does not contain the plugin UI/runtime.

## Repository Structure

```text
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
      hero/

scripts/
  validate-token-projects.ts
  detect-affected-token-projects.ts
  build-token-artifacts.ts
  check-stale-token-pr.ts
  create-target-merge-requests.ts
  lib/
    artifact-output.ts
    html-artifacts.ts
    project-selection.ts
    style-dictionary.ts
    themes.ts
    token-utils.ts
    types.ts

projects.config.json
targets.config.json
docs/
.github/workflows/
```

## Core Concepts

- `token-definitions/projects/{project-id}/tokens.json` is plugin-submitted token
  source. It includes token sets, values, `$themes`, and `$metadata`.
- `$themes[].selectedTokenSets` accepts `source`, `enabled`, and `disabled`.
  Central build treats `source` and `enabled` as active sets, expands sibling
  enabled scheme sets into effective themes, keeps `source` sets as reference
  context, validates set-qualified aliases inside each effective theme context,
  and rejects missing-set, inactive-context, or cyclic aliases.
- `projects.config.json` defines which token projects are built by theme.
- `blocks/` contains beta static HTML block contracts and examples.
- `scripts/build-token-artifacts.ts` orchestrates Style Dictionary token
  processing, beta static HTML generation, and `manifest.json` output.
- `targets.config.json` describes where generated themed artifacts can be
  delivered. Target projects own any child-project mapping after consuming the
  selected theme output.
- `scripts/create-target-merge-requests.ts` validates target delivery locally
  by default and can create target project PRs/MRs in explicit apply mode.

## Commands

Install dependencies:

```bash
npm ci
```

`package-lock.json` is intentionally tracked so local development and CI use the
same `style-dictionary` version.

Validate token projects:

```bash
npm run validate:tokens
```

Typecheck TypeScript scripts:

```bash
npm run typecheck
```

Run repository tests:

```bash
npm test
```

Build generated artifacts:

```bash
npm run build:artifacts
```

Build one affected project:

```bash
TOKEN_PROJECTS=project-c npm run build:artifacts
```

Run the token processing build boundary directly:

```bash
npm run build:style-dictionary
```

Check stale PR state:

```bash
npm run check:stale-token-pr
```

Validate target MR delivery without writing to target repositories:

```bash
npm run delivery:target-mr
```

Create target PRs/MRs after artifacts are built:

```bash
GH_TOKEN=... npm run delivery:target-mr -- --apply
```

Run the full local central-repo check:

```bash
npm run validate
```

## Expected Outputs

`npm run validate:tokens`:

```text
Validated 2 token file(s); 0 pending first sync project(s).
```

`npm run build:artifacts`:

```text
Built project-a into dist/project-a
Built project-b into dist/project-b
```

If a project is configured before its first plugin-submitted `tokens.json`
exists, validation reports it as pending and build/delivery skip only that
project until the first plugin PR/MR creates the file.

`npm run delivery:target-mr`:

```text
Target delivery MR for project-a
Target delivery MR for project-b
```

## Generated Artifacts

Build output is written under `dist/`:

```text
dist/project-a/css/project-a.reference.css
dist/project-a/css/project-a.tokens.css
dist/project-a/css/project-a.light.tokens.css
dist/project-a/css/project-a.dark.tokens.css
dist/project-a/json/project-a.light.resolved-tokens.json
dist/project-a/json/project-a.light.metadata.json
dist/project-a/html/*.html
dist/project-a/manifest.json
```

Projects that set `"themeFolders": true` in `projects.config.json` use an
isolated parent-theme layout instead:

```text
dist/project-a/css/health/reference.css
dist/project-a/css/health/token.css
dist/project-a/css/health/health-white.css
dist/project-a/css/health/health-black.css
dist/project-a/css/cx/reference.css
dist/project-a/css/cx/token.css
dist/project-a/css/cx/cx-white.css
dist/project-a/css/cx/cx-black.css
```

In this mode, source and reference roots are computed within each parent theme.
A set marked `source` in `health` therefore does not become a source for `cx`.
The default remains the flat layout for projects that omit the option.

Flat generated artifact filenames use:

```text
{project-id}.{theme-id}.{artifact-type}.{ext}
```

When two expanded themes produce the same flat `{theme-id}` and use the same
ordered effective token sets, the build writes one shared artifact instead of
failing. If the generated id matches but the effective sets differ, the build
still fails because the filename would hide different output.

The aggregate CSS file uses:

```text
{project-id}.tokens.css
```

When present, the shared reference CSS file uses:

```text
{project-id}.reference.css
```

Source token files stay at:

```text
token-definitions/projects/{project-id}/tokens.json
```

`dist/` is intentionally ignored by Git.

HTML blocks and demo pages are beta features. They are useful for preview and
copy/paste experiments, but they are not part of the stable production artifact
contract yet.

## Documentation

Active central-repo docs live in `docs/`.

Start with:

- `docs/repository-structure.md`
- `docs/ci-cd.md`
- `docs/affected-project-ci.md`
- `docs/style-dictionary-build.md`
- `docs/generated-artifacts.md`
- `docs/release-workflow.md`
- `docs/target-project-delivery.md`

## Current Cleanup Position

This repository was duplicated from the plugin repository and has been cleaned
toward a central-token role.

Removed from this repo:

- React/Vite plugin UI source.
- Figma plugin runtime source.
- Figma plugin manifest.
- Vite/TypeScript plugin build config.
- Plugin public assets.
- Plugin UI design note.
- Historical planning docs, bilingual mirrors, and plugin-workspace tracking.

Kept in this repo:

- Token source fixtures.
- Project and target config.
- Build/validation scripts.
- Block contracts.
- GitHub workflow scaffolding.
- English central-repo documentation.
