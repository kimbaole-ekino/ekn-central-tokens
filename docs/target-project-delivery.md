# Target Project Delivery

Target delivery describes how generated artifacts from this central repository
reach product repositories.

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

`.github/workflows/target-delivery.yml` provides a manual workflow.

Default mode:

```text
dry_run: true
```

This builds artifacts and prints the target delivery work without writing to
external repositories.

Apply mode:

```text
dry_run: false
```

This builds artifacts and creates or updates target project PRs/MRs using the
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
        "css": "src/styles/tokens",
        "html": "src/static/blocks",
        "json": "src/styles/tokens/metadata",
        "manifest": "src/styles/tokens/manifest.json"
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

## Delivery Inputs

Target delivery requires:

- built artifacts under `dist/{project}`,
- `manifest.json`,
- target repo name,
- target base branch,
- destination paths,
- target repository token in apply mode.

## Delivery Output

The delivery script copies:

- `dist/{project}/css/` to `destination.css`,
- `dist/{project}/html/` to `destination.html`,
- `dist/{project}/json/` to `destination.json` when configured,
- `dist/{project}/manifest.json` to `destination.manifest` when configured.

It then creates a delivery branch named from:

```text
{delivery.branchPrefix}{project}-{manifest.version}
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

## Conflict And Review Boundary

If the target branch cannot be pushed cleanly, the delivery workflow should
fail and the maintainer should inspect the target project state.

The central repository should not:

- force merge into target project default branches,
- auto-approve target project PRs/MRs,
- bypass target project CI,
- resolve semantic target project conflicts without maintainer review.

