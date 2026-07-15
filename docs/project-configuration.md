# Project configuration reference

`projects.config.json` lists token projects. It is stored at the Central repository root.

## Full example

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

The top-level `projects` value must be an array. Each project allows only the three fields shown above. Extra fields fail validation.

Theme definitions, Set order, Theme combinations, and limits come from canonical `tokens.json`. Do not add them here.

## Incomplete project setup

The config entry and canonical file can be added in either order:

- Config exists but `tokens.json` is missing: validation, build, and delivery skip the project.
- `tokens.json` exists but config is missing: Central validates the file but does not build or deliver it.
- Both exist: Central validates and builds the project.

## Fields

### `id` — required

A unique, non-empty project name. Kebab-case is recommended.

```json
"id": "site-a"
```

Duplicate IDs fail validation. Project filters use this value.

### `tokenFile` — required

A repository-relative path to canonical `tokens.json`:

```json
"tokenFile": "token-definitions/projects/site-a/tokens.json"
```

The path must end in `/tokens.json`. It cannot be absolute or contain `..`.

If the file is missing, Central treats the project as waiting for its first sync. Central cannot know if a missing file is expected or if the path has a typing error. Check that this path is exactly the same as the Token Architect GitHub path.

When the file exists, it must pass shared submission validation. A path to the wrong valid file can build the wrong project, so review the path carefully.

### `outputDir` — required

A repository-relative folder for generated CSS, resolved JSON, and `manifest.json`:

```json
"outputDir": "dist/site-a"
```

Use `dist/<project-id>`. The path cannot be absolute or contain `..`. It must stay inside the repository.

The build deletes and recreates this full folder. Keep generated files only. Each project must use its own output folder.

## Generated Theme paths

One Theme Group creates flat files:

```text
dist/site-a/light.css
dist/site-a/light.json
dist/site-a/dark.css
dist/site-a/dark.json
```

Several Theme Groups create nested paths from selected Theme names in group order:

```text
dist/site-a/creative/react/light.css
dist/site-a/creative/react/light.json
```

`manifest.json` stays at the output root.

## Project filters

Without a filter, Central validates every registered project and each discovered canonical file under `token-definitions/projects/`.

Select one project:

```sh
npm run validate:tokens -- --project=site-a
```

Select several projects:

```sh
npm run validate:tokens -- --projects=site-a,site-b
TOKEN_PROJECTS=site-a npm run validate:tokens
```

Config files and links between project and target config are always checked. A selected name that is neither registered nor found as a canonical folder fails.

## Common problems

| Problem                           | Result                                               |
| --------------------------------- | ---------------------------------------------------- |
| Duplicate project ID              | Validation fails.                                    |
| Missing token file                | Registered project is skipped.                       |
| Token file without project config | File is validated, but not built or delivered.       |
| Invalid token file                | Validation and build fail.                           |
| Wrong path to a missing file      | Project stays skipped until the path is fixed.       |
| Wrong path to another valid file  | The wrong file may build. Review the path link.      |
| Absolute path or path with `..`   | Validation fails.                                    |
| Extra project field               | Validation fails.                                    |
| Unsafe output folder              | Build fails.                                         |
| Shared output folder              | One project may replace another. Use unique folders. |

See [Configuration examples](configuration-examples.md) for setup steps.
