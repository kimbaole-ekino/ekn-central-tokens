# Generated Artifacts

Generated artifacts are build outputs. They are not canonical source.

Canonical source remains:

```text
token-definitions/
projects.config.json
blocks/
targets.config.json
```

## Output Root

All generated artifacts are written under:

```text
dist/
```

`dist/` is ignored by Git.

## Project Output

Each project writes:

```text
dist/{project-id}/
  css/
  json/
  html/
  manifest.json
```

Example:

```text
dist/project-a/
  css/project-a.reference.css
  css/project-a.tokens.css
  css/project-a.light.tokens.css
  css/project-a.dark.tokens.css
  json/project-a.light.resolved-tokens.json
  json/project-a.light.metadata.json
  html/demo.html
  html/button.html
  html/hero.html
  manifest.json
```

## Naming Convention

Generated artifact naming follows:

```text
{project-id}.{theme-id}.{artifact-type}.{ext}
```

Rules:

- `project-id` and `theme-id` are kebab-case.
- `.` separates project, theme, artifact type, and extension.
- `-` is used only inside ids.
- Do not combine project and theme with a hyphen when naming generated files.
- Do not put timestamps or versions in filenames.
- Put version, build time, and source commit in `manifest.json`.

Examples:

- `project-a.tokens.css`
- `project-a.light.tokens.css`
- `project-a.dark.tokens.css`
- `project-a.light.resolved-tokens.json`
- `project-a.light.metadata.json`

Source token files remain simple:

```text
token-definitions/projects/{project-id}/tokens.json
```

## Source And Generated Files

The source token file is the reviewed input:

```text
token-definitions/projects/{project-id}/tokens.json
```

Generated files are rebuildable outputs:

```text
dist/{project-id}/css/{project-id}.{theme-id}.tokens.css
dist/{project-id}/css/{project-id}.tokens.css
dist/{project-id}/css/{project-id}.reference.css
dist/{project-id}/json/{project-id}.{theme-id}.resolved-tokens.json
dist/{project-id}/json/{project-id}.{theme-id}.metadata.json
dist/{project-id}/manifest.json
```

`manifest.json` is the canonical lookup for generated files in the central
build output. It is required in central build output, but optional in target
project delivery. It is delivered to target projects only when their tooling
needs that lookup contract.

## CSS

Projects with multiple generated schemes write CSS in two layers:

- `{project-id}.reference.css` contains shared reference tokens such as
  primitives from token sets enabled in every generated scheme.
- `{project-id}.tokens.css` and `{project-id}.{theme-id}.tokens.css` contain
  only the semantic tokens that vary by generated scheme.

Targets should load the reference file first when it exists:

```html
<link rel="stylesheet" href="project-a.reference.css" />
<link rel="stylesheet" href="project-a.tokens.css" />
```

CSS output contains color-scheme-scoped CSS custom properties in the aggregate
file:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background-primary: var(--global-color-white);
}
```

Style Dictionary is the primary engine for CSS generation.

Per-theme outputs represent one selected color scheme and therefore use plain
`:root`:

```text
dist/{project-id}/css/{project-id}.{theme-id}.tokens.css
```

Example:

```text
dist/project-a/css/project-a.light.tokens.css
```

Example per-theme CSS:

```css
/* Do not edit directly, this file was auto-generated. */

:root {
  --color-background-primary: var(--global-color-white);
}
```

Aggregate output:

```text
dist/{project-id}/css/{project-id}.tokens.css
```

Example:

```css
/* Do not edit directly, this file was auto-generated. */

:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background-primary: var(--global-color-white);
}

:root[data-color-scheme="dark"],
[data-color-scheme="dark"] {
  --color-background-primary: var(--global-color-black);
}
```

The aggregate file must not write any color scheme values directly to plain
`:root`, because there is no default color scheme. The `:root[...]` selector is
the primary integration path for `<html data-color-scheme="...">`; the plain
`[data-color-scheme="..."]` selector supports scoped sections, previews, and
isolated component demos.

Generated variable names are semantic and shared by all color schemes. The
build removes color-scheme-specific set roots from CSS variable names, including
roots that match a scheme id such as `brand-a` and roots that are unique to one
scheme such as `theme-light` or `theme-dark`. This prevents scheme-prefixed
variables such as `--brand-a-primary-color` or `--theme-light-primary-color`.

Color schemes may expose different semantic variable sets. The aggregate CSS
file writes each variable only inside the scheme block that defines it. Target
projects should only use variables that exist in the theme output they choose to
consume.

### Why Split CSS By Theme

Separate theme CSS files are the default because they make theme boundaries
explicit and keep target project usage simple:

- target projects can import only the themes they support,
- per-theme diffs are easier to review,
- cache invalidation is narrower when only one theme changes,
- `data-color-scheme` values stay short and readable, such as `light` and
  `dark`.

Tradeoffs:

- a target that wants all themes needs either multiple imports or the aggregate
  file,
- very small projects may see more files than a single bundled CSS output,
- target projects that import individual per-theme files must choose exactly
  one file for a given runtime scope because each per-theme file writes to
  plain `:root`.

The central build therefore writes both per-theme CSS and
`{project-id}.tokens.css`. Target projects should import the aggregate file when
they want every generated theme, or import individual theme files when they want
explicit control.

When a project emits `{project-id}.reference.css`, target projects must import it
before either the aggregate file or a per-theme file. This keeps shared
primitives out of every scheme block while preserving CSS variable references.

## Resolved Token JSON

Resolved token JSON contains the theme-specific resolved token document used by
target projects that consume tokens as data instead of CSS.

Output:

```text
dist/{project-id}/json/{project-id}.{theme-id}.resolved-tokens.json
```

Example:

```text
dist/project-a/json/project-a.light.resolved-tokens.json
```

## Metadata JSON

Metadata output records generated variable data:

```json
{
  "primitive.color.brand.primary": {
    "value": "#e60000",
    "originalValue": "#e60000",
    "cssVariable": "--primitive-color-brand-primary",
    "theme": "light"
  }
}
```

Output:

```text
dist/{project-id}/json/{project-id}.{theme-id}.metadata.json
```

Example:

```text
dist/project-a/json/project-a.light.metadata.json
```

## Static HTML Blocks And Demo Pages (beta)

Static HTML block generation and demo pages are beta features. They are useful
for preview and copy/paste experiments, but they are not part of the stable
production artifact contract yet.

The beta model uses block examples and templates:

```text
blocks/pools/{pool}/{block}/examples.json
blocks/pools/{pool}/{block}/template.html
```

Beta output:

```text
dist/{project-id}/html/{block-id}.html
dist/{project-id}/html/demo.html
```

Current HTML output should be treated as experimental. It is not a stable
copy/paste contract, and it is not generated from Figma layers.

## Manifest

Each project writes:

```text
dist/{project-id}/manifest.json
```

The manifest is the central build lookup for generated artifact paths. It is
also available as an optional handoff contract for target delivery when a target
project has tooling that needs it.

Recommended shape:

```json
{
  "project": "project-a",
  "version": "abc1234def56",
  "buildTime": "2026-06-26T09:00:00Z",
  "sourceCommit": "abc1234def56",
  "css": "css/project-a.tokens.css",
  "referenceCss": "css/project-a.reference.css",
  "themes": {
    "light": {
      "css": "css/project-a.light.tokens.css",
      "resolvedTokens": "json/project-a.light.resolved-tokens.json",
      "metadata": "json/project-a.light.metadata.json"
    },
    "dark": {
      "css": "css/project-a.dark.tokens.css",
      "resolvedTokens": "json/project-a.dark.resolved-tokens.json",
      "metadata": "json/project-a.dark.metadata.json"
    }
  },
  "html": {
    "demo": "html/demo.html",
    "button": "html/button.html"
  }
}
```

## Target Delivery Policy

Target project PRs/MRs should receive the files they need to run the product.
For normal CSS-token consumption, that means:

```text
css/{project-id}.tokens.css
css/{project-id}.{theme-id}.tokens.css
```

If a target opts into beta HTML delivery, it may also receive:

```text
html/*.html
```

Resolved token JSON, metadata JSON, and `manifest.json` should stay in central
build output by default. They are useful for tooling, audits, debugging,
artifact lookup, and target projects that consume token data at runtime, but
they are not required for a target that only imports CSS variables.

A target should opt into beta HTML, JSON, or manifest delivery only when it has
a concrete consumer for those files.

Future improvements:

- include artifact checksums,
- include target delivery compatibility metadata.
