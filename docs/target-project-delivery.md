# Target Project Delivery

Target delivery describes how generated artifacts from this central repository
reach product repositories. The generated artifact contract is defined in
`generated-artifacts.md`; this file only describes how those artifacts are copied
and proposed to target repositories.

## Delivery Decision

The central token repository should create target project PRs/MRs after token
artifacts are validated and built.

The central repository owns:

- building generated token artifacts,
- copying generated artifacts into configured target repositories,
- creating or updating delivery branches,
- opening target project PRs/MRs.

The target project maintainer owns:

- reviewing the generated artifact changes,
- running or validating target project CI,
- approving and merging the target project PR/MR,
- rejecting or requesting changes when delivery is not acceptable.

The central repository must not auto-merge target project PRs/MRs.

## Command

Dry-run mode is the default and is safe for local validation:

```bash
npm run delivery:target-mr
```

Apply mode creates or updates target project PRs/MRs:

```bash
GH_TOKEN=... npm run delivery:target-mr -- --apply
```

Filter to one project:

```bash
npm run delivery:target-mr -- --project=project-a
```

## Workflow

`.github/workflows/target-delivery.yml` runs automatically after changes are
merged to `main`.

Automatic mode:

```text
central token PR merged to main
-> detect affected token projects
-> rebuild affected artifacts from merged source
-> create or update target project PRs/MRs
```

The workflow also supports manual dispatch.

Default mode:

```text
dry_run: true
```

For manual dispatch, this builds artifacts and prints the target delivery work
without writing to external repositories.

Apply mode:

```text
dry_run: false
```

For automatic `main` pushes and manual dispatch with `dry_run: false`, this
builds artifacts and creates or updates target project PRs/MRs using the
`TARGET_REPOSITORY_TOKEN` repository secret.

## Required Secret

`TARGET_REPOSITORY_TOKEN` must be available to the central repository workflow.

The token must be able to:

- clone target repositories,
- push delivery branches to target repositories,
- create and update target project PRs/MRs.

Prefer a GitHub App token or narrowly scoped bot token over a personal token.

## Target Config

`targets.config.json` maps central artifacts to target destinations:

```json
{
  "targets": [
    {
      "project": "project-a",
      "repo": "org/project-a",
      "branch": "main",
      "source": "dist/project-a",
      "destination": {
        "css": "src/styles/tokens/css",
        "html": "src/styles/tokens/html"
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

### Required Fields

Each target entry requires:

| Field | Required | Meaning |
| --- | --- | --- |
| `project` | Yes | Project id. Must match `projects.config.json[].id` and the built `dist/{project-id}` folder. |
| `repo` | Yes | Target GitHub repository. Use `owner/repo` or a GitHub URL accepted by `gh repo clone`. |
| `branch` | Yes | Target base branch for the delivery PR/MR. Usually `main`. |
| `source` | Yes | Built artifact folder in this repo, usually `dist/{project-id}`. |
| `destination.css` | Yes | Directory in the target repo where generated CSS token files are copied. |
| `destination.html` | Yes | Directory in the target repo where generated static HTML block files are copied. |
| `destination.json` | No | Directory in the target repo where generated resolved token JSON and metadata JSON files are copied when the target has a runtime or tooling consumer. |
| `destination.manifest` | No | File path in the target repo for `manifest.json` when the target needs an artifact lookup contract. |
| `delivery.provider` | No | Currently expected to be `github` when present. |
| `delivery.branchPrefix` | No | Prefix for delivery branches. Defaults to `tokens/`. |
| `delivery.branchName` | No | Fixed delivery branch name. Usually omit so the script derives one from project and manifest version. |
| `delivery.title` | No | Custom PR/MR title. |
| `delivery.body` | No | Custom PR/MR body. |
| `delivery.reviewers` | No | GitHub reviewers to request. |
| `delivery.labels` | No | GitHub labels to add. |

### Mapping Model

`projects.config.json` decides which source token file is built:

```json
{
  "id": "project-c",
  "tokenFile": "token-definitions/projects/project-c/tokens.json",
  "outputDir": "dist/project-c",
  "blockPools": ["core"]
}
```

`targets.config.json` decides where that project's generated files go:

```json
{
  "project": "project-c",
  "repo": "https://github.com/kimbaole-ekino/ekn-design-tokens-target",
  "branch": "main",
  "source": "dist/project-c",
  "destination": {
    "css": "src/styles/tokens/css",
    "html": "src/styles/tokens/html"
  },
  "delivery": {
    "provider": "github",
    "branchPrefix": "tokens/",
    "labels": []
  }
}
```

The mapping is:

```text
token-definitions/projects/project-c/tokens.json
-> build output dist/project-c
-> target repo destination paths from targets.config.json
```

Generated artifact names are preserved during delivery. For example:

```text
dist/project-a/css/project-a.tokens.css
-> src/styles/tokens/css/project-a.tokens.css

dist/project-a/css/project-a.light.tokens.css
-> src/styles/tokens/css/project-a.light.tokens.css
```

Target project examples should consume generated CSS through delivered paths:

```css
@import './tokens/css/project-a.tokens.css';
```

or:

```css
@import './tokens/css/project-a.light.tokens.css';
@import './tokens/css/project-a.dark.tokens.css';
```

Then switch themes with friendly theme names:

```html
<html data-theme="light">
```

Optional JSON and manifest delivery should be configured only when the target
has a concrete consumer:

```text
dist/project-a/json/project-a.light.resolved-tokens.json
-> src/styles/tokens/json/project-a.light.resolved-tokens.json

dist/project-a/json/project-a.light.metadata.json
-> src/styles/tokens/json/project-a.light.metadata.json

dist/project-a/manifest.json
-> src/styles/tokens/manifest.json
```

### Per-Target Settings

Yes, each target project should have its own target entry.

Each target can define:

- its own repository,
- its own base branch,
- its own generated artifact destination paths,
- its own delivery branch prefix,
- optional reviewers and labels.

Multiple target entries may point to the same `project` if the same generated
artifact must be delivered to more than one repository. In that case each entry
should still have its own `repo`, `branch`, and destination paths.

## Delivery Inputs

Target delivery requires:

- built artifacts under `dist/{project-id}`,
- `manifest.json` in central build output,
- target repo name,
- target base branch,
- destination paths,
- target repository token in apply mode.

## Delivery Output

The delivery script copies:

- `dist/{project-id}/css/` to `destination.css`,
- `dist/{project-id}/html/` to `destination.html`,
- `dist/{project-id}/json/` to `destination.json` only when configured,
- `dist/{project-id}/manifest.json` to `destination.manifest` only when
  configured.

By default, target PRs/MRs should include CSS and static HTML only. Metadata
JSON, resolved token JSON, and `manifest.json` are central build artifacts for
tooling, debugging, audits, and artifact lookup. Deliver them to a target only
when the target project has documented runtime or tooling usage for them.

The target project review and approval happens through the target PR/MR unless
a target repository documents a separate manual release process.

It then creates a delivery branch named from:

```text
{delivery.branchPrefix}{project-id}-{manifest.version}
```

Example:

```text
tokens/project-a-20260625T080000Z
```

## Apply-Mode Flow

```text
1. Build artifacts in this repo.
2. Read targets.config.json.
3. Clone the target repository.
4. Create or reset the delivery branch.
5. Copy generated artifacts into destination paths.
6. Commit changed generated artifacts.
7. Push the delivery branch.
8. Create or update the target project PR/MR.
9. Target project maintainer reviews and merges.
```

## Current Implementation Status

Target PR/MR creation is implemented, but it only works in apply mode when real
target repositories and credentials are configured.

Current status:

- dry-run mode works locally without credentials after artifacts are built,
- apply mode uses `gh`, `git`, and `GH_TOKEN`/`GITHUB_TOKEN`,
- the GitHub Actions apply path runs after pushes to `main` and requires
  `TARGET_REPOSITORY_TOKEN`,
- target delivery is scoped by affected project when the workflow is triggered
  by a `main` push,
- target maintainers still review and merge the target PR/MR,
- `project-a` and `project-b` currently use placeholder repos and must be
  replaced before apply mode can work for them.

## Conflict And Review Boundary

If the target branch cannot be pushed cleanly, the delivery workflow should
fail and the maintainer should inspect the target project state.

The central repository should not:

- force merge into target project default branches,
- auto-approve target project PRs/MRs,
- bypass target project CI,
- resolve semantic target project conflicts without maintainer review.
