# Project configuration reference

`projects.config.json` registers the canonical token projects that Central can validate and build. It is read from the repository root.

## Complete example

```json
{
  "projects": [
    {
      "id": "site-a",
      "tokenFile": "token-definitions/projects/site-a/tokens.json",
      "outputDir": "dist/site-a"
    }
  ]
}
```

The top-level `projects` field is required and must be an array. Each project accepts exactly the three fields below; extra fields fail validation. Theme choices, group order, and permutation limits are derived from the canonical token document and are not project configuration.

## Fields

### `id` — required

A non-empty, unique project identifier. Central uses it in validation messages, build logs, the generated manifest, project selection, and target delivery. It must exactly match `targets.config.json.targets[].project` when the project has a delivery target.

Central does not enforce an identifier format. Use kebab-case and match the folder under `token-definitions/projects/` so paths and logs remain easy to recognize.

```json
"id": "site-a"
```

An empty or duplicate ID fails validation.

### `tokenFile` — required

A repository-relative path to the canonical `tokens.json` updated by the Plugin. The path must end in `/tokens.json`; it cannot be absolute or contain `..`.

```json
"tokenFile": "token-definitions/projects/site-a/tokens.json"
```

The file must exist and pass the shared submission validator. A missing or invalid file fails validation and build. A path to a different valid token document can successfully build the wrong project, so verify this relationship during review.

### `outputDir` — required

A repository-relative directory where Central writes generated CSS, resolved JSON, and `manifest.json`. Use `dist/<project-id>`.

```json
"outputDir": "dist/site-a"
```

The path cannot be absolute or contain `..`, and the build also checks that it resolves inside the repository. The whole directory is generated: every build removes it recursively and recreates it. Never put manually maintained source files in it.

Output directories must be unique. Central does not currently detect two projects with the same `outputDir`; avoid this configuration because one project build can replace the other project's artifacts.

## Generated Theme paths

For exactly one Theme Group, Central omits the group folder:

```text
dist/<project>/<theme>.css

dist/site-a/site-a-light.css
dist/site-a/site-a-dark.css
```

For multiple Theme Groups, Central preserves the existing nested structure. One normalized selected Theme name per group becomes a path segment, in canonical group order; the last segment is the filename:

```text
dist/<project>/<group>/<theme>.css

dist/site-a/brand/light.css
dist/site-a/campaign/light.css
```

The corresponding resolved `.json` files use the same relative paths. `manifest.json` is written at the project output root.

## Validation and troubleshooting

| Problem                                                  | Expected result                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Duplicate project ID                                     | Validation fails.                                                              |
| Missing token file                                       | Validation fails.                                                              |
| Invalid token document                                   | Validation fails with shared-validator diagnostics.                            |
| Incorrect `tokenFile` pointing to another valid document | The wrong document may build; review the project/path relationship.            |
| Absolute path or path containing `..`                    | Validation fails.                                                              |
| Extra project field                                      | Validation fails.                                                              |
| Incorrect `outputDir`                                    | Build writes to that generated location or fails if it escapes the repository. |
| Two projects share an output directory                   | Not currently detected; one build can replace the other output.                |

See [Configuration examples](configuration-examples.md) for a complete setup walkthrough.
