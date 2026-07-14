# Target delivery configuration reference

`targets.config.json` defines where Central delivers generated artifacts after building a registered project. It is read from the repository root. Current targets normally configure CSS only.

## Complete example

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

The top-level `targets` field is required and must be an array. Target, destination, and delivery objects accept only the fields documented below; extra fields fail validation.

## Required target fields

### `project`

References `projects.config.json.projects[].id` and must match an existing ID exactly. An unknown project fails validation.

```json
"project": "site-a"
```

### `repo`

The target Git repository that receives generated files. It must be a non-empty string and accessible to the GitHub CLI and CI credentials used in apply mode. GitHub `owner/repo`, HTTPS, and SSH forms are accepted by delivery; authenticated push setup requires a `github.com` repository.

```json
"repo": "https://github.com/example/site-a.git"
```

An inaccessible repository, invalid GitHub location, or insufficient token permission fails delivery while cloning, configuring the authenticated remote, pushing, or creating the pull request.

### `branch`

The existing base branch in the target repository.

```json
"branch": "main"
```

Central checks out a separate delivery branch and opens a pull request into this branch. It never commits generated files directly to the base branch. A missing branch fails delivery when the repository is cloned.

### `source`

The generated source directory in Central. It must exactly equal the selected project's `outputDir`.

```json
"source": "dist/site-a"
```

A mismatch fails validation. Delivery also requires `<source>/manifest.json`, so running delivery before the artifact build fails clearly.

### `destination.css`

The repository-relative destination directory inside the target repository. It cannot be absolute or contain `..`.

```json
"destination": {
  "css": "src/styles/generated-tokens"
}
```

In apply mode, Central removes the entire configured destination before copying generated CSS. The directory must contain generated files only. Do not place manual CSS, application source, or any file that must survive delivery inside it.

Central recursively copies `.css` files and preserves paths relative to `source`:

```text
One Theme Group

Central: dist/site-a/site-a-light.css
Target:  src/styles/generated-tokens/site-a-light.css

Multiple Theme Groups

Central: dist/site-a/brand/light.css
Target:  src/styles/generated-tokens/brand/light.css
```

A longer destination adds folders before the artifact structure:

```json
"css": "src/styles/tokens/havas"
```

```text
src/styles/tokens/havas/site-a-light.css
src/styles/tokens/havas/brand/light.css
```

## Optional destination fields

### `destination.json`

Optional repository-relative directory for resolved JSON. When present, Central removes that destination and recursively copies generated `.json` files except `manifest.json`, preserving relative paths. When omitted, resolved JSON remains in Central.

```json
"json": "src/generated-tokens/json"
```

### `destination.manifest`

Optional repository-relative file path for the project `manifest.json`. Central removes/replaces that configured path during apply delivery. When omitted, the manifest remains in Central.

```json
"manifest": "src/generated-tokens/manifest.json"
```

CSS is required; JSON and manifest delivery are optional. Destinations on the same repository and base branch cannot be identical or nested inside one another, including destinations belonging to different target entries. Conflicts fail validation.

## Optional `delivery` fields

The entire `delivery` object is optional. Omitting it uses GitHub delivery with the defaults below.

Keep `provider` in explicit configurations so provider intent is visible and another provider can be added without inference. Only GitHub is implemented today; GitLab delivery is not implemented yet.

| Field          | Required | Default                                              | Valid example                                 | Invalid value                                                                                                                                    |
| -------------- | -------- | ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `provider`     | Optional | `github`                                             | `"github"`                                    | Any other value fails validation because only GitHub is implemented.                                                                             |
| `branchPrefix` | Optional | `"tokens/"`                                          | `"design-tokens/"`                            | Empty or non-string values fail validation. Ignored when `branchName` is set.                                                                    |
| `branchName`   | Optional | Generated from prefix, project, and manifest version | `"tokens/site-a-release"`                     | Empty or non-string values fail validation. Overrides `branchPrefix`.                                                                            |
| `title`        | Optional | `Update <project> design token artifacts`            | `"Update Site A tokens"`                      | Empty or non-string values fail validation.                                                                                                      |
| `body`         | Optional | Generated delivery summary and review instruction    | `"Generated token update.\n\nPlease review."` | Empty or non-string values fail validation.                                                                                                      |
| `reviewers`    | Optional | `[]`                                                 | `["octocat", "design-system"]`                | Must be an array of non-empty strings; invalid configuration fails validation. GitHub rejects unknown or unauthorized reviewers during PR setup. |
| `labels`       | Optional | `[]`                                                 | `["design-tokens", "automated"]`              | Must be an array of non-empty strings; invalid configuration fails validation. GitHub rejects unavailable labels during PR setup.                |

With the current manifests, which have no `version`, this configuration:

```json
{
  "provider": "github",
  "branchPrefix": "tokens/"
}
```

generates:

```text
tokens/site-a-current
```

Delivery reads an optional `version` from the built manifest. Central-generated manifests currently omit it, so the fallback is `current`. If a supplied manifest contains the field, its value replaces `current`. A configured `branchName` always takes precedence.

## Dry-run and apply

Build before delivery:

```sh
npm run validate:tokens
npm run build:artifacts
```

Delivery is a dry-run by default:

```sh
npm run delivery:target-mr
```

Select one project when needed:

```sh
npm run delivery:target-mr -- --project=site-a
```

The dry-run validates built manifests and prints the mode, repository, base branch, generated delivery branch, source, title, and root artifact mapping. It does not clone, copy, push, or open a pull request. Example mapping:

```text
Mode: dry-run
Delivery branch: tokens/site-a-current
Artifact mappings:
- dist/site-a -> src/styles/generated-tokens
```

After reviewing the build and dry-run, apply with GitHub credentials that can clone, push, and create pull requests:

```sh
GH_TOKEN=... npm run delivery:target-mr -- --project=site-a --apply
```

`GITHUB_TOKEN` is also accepted. CI normally supplies the credential and apply flag. Apply mode clones the base branch, recreates configured destinations, commits changes on the delivery branch, force-pushes with lease, and creates or updates the pull request.

## Validation and troubleshooting

| Problem                                                                 | Expected result                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Unknown project ID                                                      | Validation fails.                                                                |
| `source` does not match project output                                  | Validation fails.                                                                |
| Built manifest is missing                                               | Delivery fails before planning mappings.                                         |
| Target branch does not exist                                            | Apply delivery fails while cloning.                                              |
| Repository is inaccessible                                              | Apply delivery fails.                                                            |
| Destination is absolute, contains `..`, or overlaps another destination | Validation fails.                                                                |
| Destination contains manual files                                       | Files may be removed during apply delivery.                                      |
| Invalid reviewer or label configuration                                 | Validation fails; valid-looking but unavailable GitHub values may fail PR setup. |
| Provider other than GitHub                                              | Validation fails clearly; it does not fall back to GitHub.                       |
| Missing apply credential                                                | Apply delivery fails before cloning.                                             |
| Extra target, destination, or delivery field                            | Validation fails.                                                                |

See [Configuration examples](configuration-examples.md) for complete project and target setup walkthroughs.
