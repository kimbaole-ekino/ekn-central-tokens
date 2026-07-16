# Maintainer guide

## Review the contract

For token changes, check stable Theme IDs, Set order, Set states, references, and the number of Theme combinations. Project configuration must contain only `id`, `tokenFile`, and `outputDir`. Theme setup does not belong there.

For build changes, check output path conflicts, CSS name conflicts, selectors, reference output, stable JSON, and manifest data. For delivery changes, check the target repository, branch, source, safe destinations, and listed file types.

## Add a project

Check that:

- a present `tokens.json` passes shared submission validation;
- project ID and output folder are unique and safe;
- target `source` is the same as project `outputDir`;
- target destinations do not overlap;
- two builds create the same output tree;
- dry-run shows only expected files;
- target maintainers understand `data-color-scheme` and the pull-request process.

A registered project may wait for its first `tokens.json`. Central skips it until the file exists.

## Release proof

Use Node 22. Run tests, typecheck, token validation, artifact build, and delivery dry-run. Keep CI logs and Central artifacts long enough to investigate target problems.

A small green test is not enough for a change to selectors, paths, manifests, or delivery.

## Incidents and recovery

Stop delivery if output or mappings are unclear. Find the owning canonical or build change. Fix it through a reviewed pull request, rebuild, and create a new target delivery.

Do not patch generated target CSS by hand. The next delivery replaces it.
