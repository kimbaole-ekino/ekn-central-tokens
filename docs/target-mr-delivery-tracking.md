# Target MR Delivery Tracking

## Decision

`ekn-central-tokens` should create target project PRs/MRs after central token
artifacts are validated and built.

Target project maintainers remain responsible for review, target CI, approval,
and merge.

## Implemented

- Added `scripts/create-target-merge-requests.mjs`.
- Replaced `delivery:target-plan` with `delivery:target-mr`.
- Kept dry-run mode as the default local validation behavior.
- Added apply mode through `npm run delivery:target-mr -- --apply`.
- Updated `.github/workflows/target-delivery.yml` to support dry-run and apply
  dispatch modes.
- Added `TARGET_REPOSITORY_TOKEN` as the required workflow secret for target
  repository writes.
- Expanded `targets.config.json` to include CSS, HTML, JSON metadata, and
  manifest destinations.
- Updated central repository documentation to describe target PR/MR delivery.

## Not Implemented

- Auto-merge into target projects.
- Auto-approval of target PRs/MRs.
- Bypassing target project CI.
- Semantic conflict resolution inside target repositories.

## Required Before Real Use

- Replace placeholder repos such as `org/project-a` and `org/project-b`.
- Create a GitHub App token or narrowly scoped bot token.
- Store that token as `TARGET_REPOSITORY_TOKEN`.
- Confirm destination paths in each target project.
- Confirm target project branch protection allows bot-created PRs.
- Decide whether target PR reviewers and labels should be configured.

## Verification

Run:

```bash
npm run build:artifacts
npm run delivery:target-mr
```

Apply mode should only be run after real target repositories and credentials are
configured:

```bash
GH_TOKEN=... npm run delivery:target-mr -- --apply
```

