# Release Workflow

This repository turns reviewed token source changes into validated build
artifacts. In this document, release means a reviewed token source change has
been merged and rebuilt from `main`; target delivery means creating PRs/MRs into
product repositories.

## Current Release Flow

```text
1. Figma plugin submits token source changes through a provider-backed PR.
2. Central repo CI validates the token source.
3. CI builds generated artifacts.
4. Maintainer reviews source changes and generated artifacts.
5. PR is merged.
6. Target delivery workflow builds artifacts from merged `main`.
7. Target delivery workflow creates target project PRs/MRs.
8. Target project maintainers review and merge in their repositories.
```

The pre-merge CI build proves that token changes can build. It does not publish
or push artifacts into target projects.

## Source Of Truth

The source of truth is the merged repository state:

```text
token-definitions/
projects.config.json
blocks/
targets.config.json
```

Generated `dist/` output is rebuildable and ignored by Git.

## Review Requirements

Before merge, reviewers should check:

- token source diff is understandable,
- token set changes are intentional,
- aliases resolve,
- stable token IDs are not duplicated,
- generated CSS paths are correct,
- beta generated HTML blocks still render valid markup when block pools change,
- manifest paths match generated artifact expectations and any optional target
  delivery configuration,
- stale check is passing or intentionally skipped because SHA inputs are absent.

## Release Options

### Current Option: PR Merge + Workflow Artifact

CI uploads generated `dist/` as a workflow artifact.

Use this while the system is still stabilizing.

### Recommended Next Option: Versioned GitHub Release

After merge:

```text
1. Create release tag.
2. Build artifacts from the merge commit.
3. Upload artifact archive to GitHub Release.
4. Target projects receive delivery PRs/MRs for maintainer review.
```

Recommended tag format:

```text
tokens-YYYY.MM.DD.N
```

### Future Option: Package Publishing

Do not publish packages until target projects have a stable package consumption
contract.

Package publishing needs separate decisions for:

- package name,
- versioning,
- changelog,
- consuming target projects,
- rollback flow,
- private registry permissions.

## Rollback

Current rollback model:

```text
Create a new PR that reverts or corrects token source.
CI rebuilds artifacts.
Target delivery follows the corrected artifact.
```

Do not mutate old generated artifacts in place.
