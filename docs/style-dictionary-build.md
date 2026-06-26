# Style Dictionary Build

Style Dictionary is the primary build engine for token processing in this
central repository.

The repository uses the official `style-dictionary` npm package from
`scripts/build-token-artifacts.mjs`. The script owns repository orchestration;
Style Dictionary owns token transformation and formatting.

## Target Build Model

```text
token-definitions/projects/{project}/tokens.json
        +
projects.config.json
        |
        v
Style Dictionary config per project/theme
        |
        v
dist/{project}/css/*.css
dist/{project}/json/*.metadata.json
dist/{project}/manifest.json
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

Current implementation:

```text
scripts/build-token-artifacts.mjs
scripts/token-build-utils.mjs
style-dictionary
```

The build currently:

- validates each token document,
- skips projects whose `tokens.json` has not been created by the first plugin
  PR/MR yet,
- requires `tokens.json.$themes`,
- derives theme builds from each theme's `selectedTokenSets`,
- flattens selected token sets by theme,
- uses Style Dictionary to resolve aliases,
- uses Style Dictionary to write CSS custom properties,
- uses a Style Dictionary custom format to write metadata JSON,
- renders static HTML examples,
- writes `manifest.json`.

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

CSS:

```text
dist/{project}/css/{project}.{theme-segment}.css
```

Metadata JSON:

```text
dist/{project}/json/{theme}.metadata.json
```

Manifest:

```text
dist/{project}/manifest.json
```

## Required Transform Behavior

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
  "theme": "project-a-light"
}
```
