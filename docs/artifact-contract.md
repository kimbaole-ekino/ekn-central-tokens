# Artifact contract

## Purpose

Central builds files for review and target use. A file in `dist/` is not delivered unless `targets.config.json` maps it.

## Central output tree

For one Theme Group:

```text
dist/<project-id>/
  <theme>.css
  <theme>.json
  manifest.json
```

Example:

```text
dist/site-a/light.css
dist/site-a/light.json
dist/site-a/dark.css
dist/site-a/dark.json
dist/site-a/manifest.json
```

For several Theme Groups, selected Theme names form nested paths:

```text
dist/site-a/creative/react/light.css
dist/site-a/creative/react/light.json
```

Final paths are stable and checked for conflicts after name cleanup.

## CSS selectors

Each CSS file supports a scheme on the document root and on a smaller block:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-background: #ffffff;
}
```

The target app decides which element owns `data-color-scheme`.

## CSS references

A simple direct token reference stays linked when both CSS variables are safe:

```css
--color-primary: #0055ff;
--button-background: var(--color-primary);
```

Resolved JSON stores the final value. Central writes a fixed value for complex, embedded, unsupported, or unsafe references.

## Manifest

`manifest.json` records output IDs, selected Themes, and file paths. Central uses it for review and delivery planning. Target apps do not need it at runtime.

## Delivery boundary

Current targets have only `destination.css`. Therefore:

- CSS is copied with its nested paths;
- resolved JSON is not copied;
- `manifest.json` is not copied.

Add an exact destination and tests before delivering another format.

## Changes that need target review

Coordinate with target maintainers when changing selectors, CSS variable names, Theme path rules, reference output, delivery folders, or generated scheme names.
