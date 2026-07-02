# Style Dictionary Build

Style Dictionary is the primary build engine for token processing in this
central repository.

The repository uses the official `style-dictionary` npm package with
`@tokens-studio/sd-transforms` from `scripts/lib/style-dictionary.ts`. The
script owns repository orchestration; Style Dictionary owns token transformation
and formatting. The generated artifact contract is documented in
`generated-artifacts.md`; this file focuses on how the build produces that
contract.

## Target Build Model

```text
token-definitions/projects/{project-id}/tokens.json
        +
projects.config.json
        |
        v
Style Dictionary config per project/theme
        |
        v
dist/{project-id}/css/{project-id}.{theme-id}.tokens.css
dist/{project-id}/css/{project-id}.tokens.css
dist/{project-id}/json/{project-id}.{theme-id}.resolved-tokens.json
dist/{project-id}/json/{project-id}.{theme-id}.metadata.json
dist/{project-id}/manifest.json
```

## Style Dictionary Responsibilities

Style Dictionary should own:

- token flattening,
- alias/reference resolution,
- value transforms,
- CSS custom property formatting,
- token metadata JSON output,
- deterministic output formatting,
- project/theme output generation.

The central repo scripts should own orchestration:

- reading `projects.config.json`,
- deriving build themes from `tokens.json.$themes`,
- building each project/theme target,
- validating inputs before build,
- writing the final manifest,
- running static HTML block generation.

## Current Implementation

Current token processing command:

```bash
npm run build:style-dictionary
```

Full artifact command:

```bash
npm run build:artifacts
```

Build a selected project:

```bash
TOKEN_PROJECTS=project-c npm run build:artifacts
```

or:

```bash
npm run build:artifacts -- --project=project-c
```

Current implementation:

```text
scripts/build-token-artifacts.ts
scripts/lib/artifact-output.ts
scripts/lib/html-artifacts.ts
scripts/lib/project-selection.ts
scripts/lib/style-dictionary.ts
scripts/lib/themes.ts
scripts/lib/token-utils.ts
scripts/lib/types.ts
style-dictionary
@tokens-studio/sd-transforms
```

The build currently:

- validates each token document,
- skips projects whose `tokens.json` has not been created by the first plugin
  PR/MR yet,
- supports affected-project build filtering,
- requires `tokens.json.$themes`,
- derives theme builds from each theme's `selectedTokenSets`,
- treats `source` and `enabled` token-set states as active for central builds
  while rejecting invalid states during validation,
- flattens selected token sets by theme,
- applies the Tokens Studio preprocessor and `tokens-studio` transform group,
- uses Style Dictionary to resolve aliases,
- uses Style Dictionary to write CSS custom properties,
- writes shared reference CSS once when token sets are enabled in every
  generated color scheme,
- writes one `:root` CSS file per theme/color scheme and one aggregate CSS file
  with explicit `data-color-scheme` selector blocks for semantic scheme tokens,
- uses a Style Dictionary custom format to write resolved token JSON,
- uses a Style Dictionary custom format to write metadata JSON,
- renders static HTML examples and a full generated demo page,
- writes `manifest.json`.

## Tokens Studio Transforms

`@tokens-studio/sd-transforms` is used at the Style Dictionary boundary to keep
the central build compatible with Tokens Studio token exports while preserving
the existing repository orchestration.

The build registers the package once, then uses:

```js
preprocessors: ["tokens-studio"];
transformGroup: "tokens-studio";
transforms: ["name/kebab"];
```

This is intentionally a low-risk integration:

- the dependency version is compatible with Style Dictionary 4,
- token document validation remains in `scripts/lib/token-utils.ts`,
- project/theme selection still comes from `$themes[].selectedTokenSets`,
- `selectedTokenSets` state values must be `source`, `enabled`, or `disabled`,
- aliases must be set-qualified, such as `{global.color.brand}`, so the
  reference origin is explicit,
- local Tokens Studio aliases without a set name, such as `{color.brand}`, are
  rejected because they are ambiguous when multiple sets are active,
- alias validation runs against the same effective theme set groups that the
  artifact build uses after sibling scheme-set expansion,
- `source` sets stay in the reference/base context during scheme expansion;
  only enabled non-source sibling sets become generated scheme outputs,
- nested references inside composite token values, such as border or shadow
  color fields, are validated with the same context rules,
- custom formats still own resolved token JSON and metadata JSON shape.

## Style Dictionary Structure

The TypeScript build is split so the command entrypoint stays small:

```text
scripts/build-token-artifacts.ts        # command orchestration
scripts/lib/style-dictionary.ts         # SD config, formats, CSS naming
scripts/lib/themes.ts                   # theme and mode-set expansion
scripts/lib/token-utils.ts              # validation and JSON helpers
scripts/lib/html-artifacts.ts           # demo and block HTML output
scripts/lib/artifact-output.ts          # filesystem output helpers
```

## Output Naming

Generated artifact naming is defined in `generated-artifacts.md`. The Style
Dictionary build must produce that contract without redefining a different file
layout here.

The main outputs are:

```text
dist/{project-id}/css/{project-id}.reference.css
dist/{project-id}/css/{project-id}.{theme-id}.tokens.css
dist/{project-id}/css/{project-id}.tokens.css
dist/{project-id}/json/{project-id}.{theme-id}.resolved-tokens.json
dist/{project-id}/json/{project-id}.{theme-id}.metadata.json
dist/{project-id}/manifest.json
```

## Required Transform Behavior

Aggregate CSS selectors use friendly generated theme names as color scheme ids:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background-primary: var(--global-color-white);
}
```

The `:root[...]` selector is the primary full-site integration path for
`<html data-color-scheme="light">`. The plain `[data-color-scheme]` selector is
also emitted so flexible components, sections, previews, and isolated demos can
scope color scheme overrides.

The generated aggregate CSS file contains one selector block per theme/color
scheme. When reference token sets are shared by every generated scheme, the
aggregate file contains only semantic scheme tokens and depends on
`{project-id}.reference.css` being loaded first. It must not write scheme values
directly to plain `:root` because there is no default color scheme:

```css
/* {project-id}.reference.css */
:root {
  --global-color-white: #ffffff;
  --global-color-black: #000000;
}

/* {project-id}.tokens.css */
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background-primary: var(--global-color-white);
}

:root[data-color-scheme="dark"],
[data-color-scheme="dark"] {
  --color-background-primary: var(--global-color-black);
}
```

Per-theme CSS files represent one selected scheme and can use plain `:root`:

```css
:root {
  --color-background-primary: var(--global-color-white);
}
```

Aliases should become CSS references when possible:

```css
--color-background-primary: var(--global-color-white);
```

Resolved metadata should preserve both:

```json
{
  "value": "#ffffff",
  "originalValue": "{global.color.white}",
  "cssVariable": "--color-background-primary",
  "theme": "light"
}
```

The build removes color-scheme-specific set roots from CSS variable names. This
includes roots that match the generated scheme id, such as `brand-a`, and roots
that are selected by only one scheme, such as `theme-light` or `theme-dark`. The
result keeps variables semantic and shared across schemes instead of emitting
scheme-prefixed names such as `--brand-a-primary-color` or
`--theme-light-primary-color`.

After normalization, every color scheme must expose the same CSS variable names.
If one scheme is missing a variable or emits an extra variable, the build fails
before writing the aggregate CSS contract.
