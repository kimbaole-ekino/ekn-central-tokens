# Nested artifacts

Each Theme context produces CSS and resolved JSON; the project produces one root `manifest.json`.

## Paths

For exactly one group, output is `<theme-slug>.css` and `.json`, for example `light.css`; the group name is omitted. For multiple groups, the existing nested structure is preserved: ordered Theme names become path segments and the final name is the filename, such as `creative/react/dark.css`.

The output ID joins ordered Theme names with hyphens (`creative-react-dark`). Names are Unicode-normalized, non-alphanumeric runs become hyphens, and the value is lowercased. Empty and unsafe names fail the build. Two contexts fail only when their case-insensitive normalized final artifact paths collide. Identical output IDs and CSS selectors are allowed when the artifact paths differ; the manifest uses the artifact base path to disambiguate the repeated key.

Theme Groups provide artifact-file isolation, not CSS runtime isolation.

CSS files from different groups may contain the same data-color-scheme
selector. Consumers should normally import only the required group. If files
from multiple groups are loaded into the same document, the consuming
application is responsible for CSS cascade and precedence.

## CSS

Every file scopes variables to both root and descendant selectors:

```css
:root[data-color-scheme="light"],
[data-color-scheme="light"] {
  --color-primary: #0055ff;
  --button-background: var(--color-primary);
}
```

Style Dictionary provides transformed kebab names. Two canonical paths mapping to the same case-insensitive CSS name fail with provenance. Simple direct aliases use `var()`; literals and values without a safe one-property alias remain static. No fallback is added because the referenced declaration is generated in the same effective graph and a missing declaration should remain visible.

## Resolved JSON and manifest

JSON maps canonical token paths to transformed type and fully resolved value, useful for CI comparison and debugging. The manifest maps a stable output key—normally the output ID, or the artifact base path when a repeated ID needs disambiguation—to ordered `{group,id,name}` Themes and relative CSS/JSON paths. Both are central artifacts; current delivery mappings copy only CSS.

Builds are deterministic: the output directory is recreated, records are path-sorted, JSON formatting is stable, and repeated builds from identical input produce identical trees.
