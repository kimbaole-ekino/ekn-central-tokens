# Nested artifacts

Central builds one output for each valid Theme context.

## Paths

One Theme Group creates flat files:

```text
dist/<project>/<theme>.css
dist/<project>/<theme>.json
```

Several Theme Groups create nested paths. Theme Group order follows the first appearance of each group in `$themes`:

```text
dist/<project>/<theme-1>/<theme-2>.css
dist/<project>/<theme-1>/<theme-2>.json
```

The last selected Theme becomes the filename. Earlier selected Themes become folders. Group names are not used in the path.

Central checks the final path after names are cleaned. Two contexts may have the same selector or output ID when their final paths are different.

## CSS

The selector ID joins the cleaned selected Theme names with `-`. Every file includes both forms:

```css
:root[data-color-scheme="creative-dark"],
[data-color-scheme="creative-dark"] {
  /* variables */
}
```

If several Theme Group files are loaded together, the target app owns CSS order and cascade.

## JSON and manifest

Resolved JSON uses the same path as CSS with a `.json` ending. `manifest.json` stays at the project output root and maps each context to its CSS and JSON files.

The build replaces the full project output folder. Keep only generated files there.
