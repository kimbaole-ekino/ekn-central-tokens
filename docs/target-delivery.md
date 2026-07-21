# Target delivery configuration reference

`targets.config.json` tells Central where to send built files. It is stored at the Central repository root. Each target receives only its configured artifact types.

## Full example

```json
{
  "targets": [
    {
      "project": "site-a",
      "repo": "https://github.com/example/site-a.git",
      "branch": "main",
      "source": "dist/site-a",
      "destination": {
        "css": "src/styles/generated-tokens"
      },
      "delivery": {
        "provider": "github",
        "branchPrefix": "tokens/",
        "labels": []
      }
    }
  ]
}
```

The top-level `targets` value must be an array. Target, destination, and delivery objects allow only the fields below. Extra fields fail validation.

## Required target fields

### `project`

The exact project ID from `projects.config.json`:

```json
"project": "site-a"
```

An unknown project fails validation.

### `repo`

The target Git repository. GitHub `owner/repo`, HTTPS, and SSH forms are accepted.

```json
"repo": "https://github.com/example/site-a.git"
```

Apply mode needs access to clone, push, and open a pull request. A wrong repository or missing access fails delivery.

### `branch`

The target base branch:

```json
"branch": "main"
```

Central creates a separate delivery branch and opens a pull request to this branch. It never commits to the base branch.

### `source`

The Central build folder. It must exactly match the project's `outputDir`.

```json
"source": "dist/site-a"
```

For a ready project, delivery needs `<source>/manifest.json`. Build before delivery. A project without `tokens.json` is skipped before this check.

### `destination.css`

The target folder for generated CSS:

```json
"destination": {
  "css": "src/styles/generated-tokens"
}
```

The path must be relative and cannot contain `..`. In apply mode, Central deletes and recreates the full folder. Keep generated files only.

Central copies `.css` files and keeps paths under `source`:

```text
Central: dist/site-a/light.css
Target:  src/styles/generated-tokens/light.css

Central: dist/site-a/creative/react/light.css
Target:  src/styles/generated-tokens/creative/react/light.css
```

## Optional destination fields

### `destination.json`

An optional folder for resolved JSON. Central deletes and recreates it, then copies `.json` files except `manifest.json`.

```json
"json": "src/generated-tokens/json"
```

### `destination.manifest`

An optional file path for the project manifest:

```json
"manifest": "src/generated-tokens/manifest.json"
```

CSS is required. JSON and manifest delivery are optional. Destinations for the same repository and branch cannot be the same or inside one another. Overlap fails validation.

## Optional `delivery` fields

The full `delivery` object is optional. These fields are available:

| Field          | Default                                   | Rule                                                          |
| -------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `provider`     | `github`                                  | Only `github` is implemented. Other values fail.              |
| `branchPrefix` | `tokens/`                                 | Must be a non-empty string. Ignored when `branchName` is set. |
| `branchName`   | Generated                                 | A non-empty fixed delivery branch. Replaces `branchPrefix`.   |
| `title`        | `Update <project> design token artifacts` | Must be a non-empty string.                                   |
| `body`         | Generated review text                     | Must be a non-empty string.                                   |
| `reviewers`    | `[]`                                      | Must contain non-empty GitHub names.                          |
| `labels`       | `[]`                                      | Must contain non-empty GitHub label names.                    |

The normal generated branch is:

```text
<branchPrefix><project>-<manifest-version>
```

Current Central manifests have no version, so `current` is used:

```text
tokens/site-a-current
```

GitHub may reject a reviewer or label that does not exist even when the config shape is valid.

## Dry-run and apply mode

Build first:

```sh
npm run validate:tokens -- --project=site-a
npm run build:artifacts -- --project=site-a
```

Dry-run is the default:

```sh
npm run delivery:target-mr -- --project=site-a
```

It checks the manifest and prints the mode, repository, base branch, delivery branch, title, and file mappings. It does not clone, copy, push, or open a pull request.

After approval, run apply mode with a GitHub token:

```sh
GH_TOKEN=... npm run delivery:target-mr -- --project=site-a --apply
```

`GITHUB_TOKEN` also works. Apply mode clones the target, recreates listed destinations, commits changes, force-pushes with lease, and creates or updates the pull request.

## Common problems

| Problem                                   | Result                              |
| ----------------------------------------- | ----------------------------------- |
| Unknown project ID                        | Validation fails.                   |
| Source does not match project output      | Validation fails.                   |
| Project has no `tokens.json`              | Build and delivery skip it.         |
| Manifest is missing                       | Delivery fails before planning.     |
| Target branch is missing                  | Apply mode fails during clone.      |
| Repository cannot be opened               | Apply mode fails.                   |
| Destination is unsafe or overlaps another | Validation fails.                   |
| Destination has manual files              | Apply mode may delete them.         |
| Provider is not GitHub                    | Validation fails.                   |
| Apply token is missing                    | Apply mode fails before clone.      |
| Reviewer or label is not available        | GitHub pull-request setup may fail. |
| Extra config field                        | Validation fails.                   |

See [Configuration examples](configuration-examples.md) for setup steps.
