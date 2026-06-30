# Style Dictionary Build

Style Dictionary is the primary build engine for token processing in this
central repository.

The repository uses the official `style-dictionary` npm package with
`@tokens-studio/sd-transforms` from `scripts/build-token-artifacts.mjs`. The
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
scripts/build-token-artifacts.mjs
scripts/token-build-utils.mjs
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
- flattens selected token sets by theme,
- applies the Tokens Studio preprocessor and `tokens-studio` transform group,
- uses Style Dictionary to resolve aliases,
- uses Style Dictionary to write CSS custom properties,
- writes one `:root` CSS file per theme/color scheme and one aggregate CSS file
  with explicit `data-color-scheme` selector blocks,
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
- token document validation remains in `scripts/token-build-utils.mjs`,
- project/theme selection still comes from `$themes[].selectedTokenSets`,
- custom formats still own resolved token JSON and metadata JSON shape.

## Style Dictionary Structure

Current implementation is script-local. If this grows, move Style Dictionary
configuration into:

```text
build/
  style-dictionary/
    config.mjs
    transforms.mjs
    formats.mjs
    actions.mjs
```

Recommended scripts:

```json
{
  "scripts": {
    "build:style-dictionary": "node build/style-dictionary/config.mjs",
    "build:artifacts": "npm run build:style-dictionary && node scripts/build-html-artifacts.mjs"
  }
}
```

## Output Naming

Generated artifact naming is defined in `generated-artifacts.md`. The Style
Dictionary build must produce that contract without redefining a different file
layout here.

The main outputs are:

```text
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
  --primitive-color-brand-primary: #e60000;
}
```

The `:root[...]` selector is the primary full-site integration path for
`<html data-color-scheme="light">`. The plain `[data-color-scheme]` selector is
also emitted so flexible components, sections, previews, and isolated demos can
scope color scheme overrides.

The generated aggregate CSS file contains one selector block per theme/color
scheme. It must not write scheme values directly to plain `:root` because there
is no default color scheme:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --primitive-color-brand-primary: #e60000;
}

:root[data-color-scheme="dark"],
[data-color-scheme="dark"] {
  --primitive-color-brand-primary: #b00000;
}
```

Per-theme CSS files represent one selected scheme and can use plain `:root`:

```css
:root {
  --primitive-color-brand-primary: #e60000;
}
```

Aliases should become CSS references when possible:

```css
--component-button-background-primary: var(--primitive-color-brand-primary);
```

Resolved metadata should preserve both:

```json
{
  "value": "#e60000",
  "originalValue": "{primitive.color.brand.primary}",
  "cssVariable": "--component-button-background-primary",
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
