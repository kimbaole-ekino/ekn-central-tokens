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
dist/{project}/
  css/
  json/
  html/
  manifest.json
```

Example:

```text
dist/project-a/
  css/project-a.light.css
  json/project-a-light.metadata.json
  html/button.html
  html/hero.html
  manifest.json
```

## CSS

CSS output contains theme-scoped CSS custom properties:

```css
[data-theme="project-a-light"] {
  --primitive-color-brand-primary: #e60000;
  --primitive-spacing-md: 16px;
}
```

Style Dictionary is the primary engine for CSS generation.

## Metadata JSON

Metadata output records generated variable data:

```json
{
  "primitive.color.brand.primary": {
    "value": "#e60000",
    "originalValue": "#e60000",
    "cssVariable": "--primitive-color-brand-primary",
    "theme": "project-a-light"
  }
}
```

## Static HTML

Static HTML is generated from block examples and templates:

```text
blocks/pools/{pool}/{block}/examples.json
blocks/pools/{pool}/{block}/template.html
```

Output:

```text
dist/{project}/html/{block}.html
```

This is a delivery artifact for target projects that need static HTML snippets.
It is not generated from Figma layers.

## Manifest

Each project writes:

```text
dist/{project}/manifest.json
```

The manifest is the handoff contract for target delivery.

Current shape:

```json
{
  "project": "project-a",
  "version": "20260625T120000Z",
  "themes": {
    "project-a-light": {
      "css": "css/project-a.light.css",
      "metadata": "json/project-a-light.metadata.json"
    }
  },
  "html": {
    "button": "html/button.html"
  }
}
```

Future improvements:

- derive version from Git commit SHA or release tag,
- include source commit,
- include build timestamp separately from version,
- include artifact checksums,
- include target delivery compatibility metadata.
