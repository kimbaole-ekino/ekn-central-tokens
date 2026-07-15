# Artifact contract

## Purpose

The central build produces evidence for maintainers and a CSS runtime contract for targets. The presence of a file in `dist/` does not automatically make it a target deliverable.

## Central artifact tree

For each project and derived Theme context:

```text
dist/{project-id}/
  {theme-slug}.css
  {theme-slug}.json
  manifest.json
```

With the current one-group Light/Dark fixtures, the output is:

```text
dist/{project-id}/light.css
dist/{project-id}/light.json
dist/{project-id}/dark.css
dist/{project-id}/dark.json
dist/{project-id}/manifest.json
```

The group folder is omitted when the document has exactly one Theme Group. Documents with multiple Theme Groups retain their existing nested paths. Final artifact paths are deterministic and collision-checked after normalization.

## CSS selector contract

Every generated scheme file supports both ownership strategies:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background: ...;
}
```

The first selector supports a scheme placed on `<html>`. The second supports a scheme placed on a page block, preview, or component boundary. Central provides both forms; each target must define which element owns the attribute.

## Alias contract

A simple direct canonical alias remains a CSS relationship when both declarations are emitted safely:

```css
--color-primary: #0055ff;
--button-background: var(--color-primary);
```

Resolved JSON contains the final value. Composite values, embedded aliases, unsupported relationships, or missing emitted targets are written as resolved literals instead of unsafe `var()` expressions.

## Manifest role

`manifest.json` records generated context IDs, Theme identity, and artifact paths. It is central build evidence and input to delivery planning. It is not an application runtime dependency.

## Delivery boundary

Current target entries declare only `destination.css`. Therefore:

- CSS files are recursively copied while preserving nested paths;
- resolved JSON is not copied;
- `manifest.json` is not copied;
- deleting `destination.json` and `destination.manifest` is the complete CSS-only configuration change.

A target requiring another format must add an explicit destination and tests. Do not infer delivery from extension alone.

## Breaking changes

The following require target coordination and contract tests:

- selector changes;
- custom-property naming changes;
- group/theme path normalization changes;
- alias-to-literal behavior changes;
- destination layout changes;
- removing or renaming a generated scheme.
