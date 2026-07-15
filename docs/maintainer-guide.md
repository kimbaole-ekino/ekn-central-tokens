# Maintainer guide

## Review by contract

For canonical changes, inspect stable Theme IDs, Set order, statuses, aliases, permutation count, and shared submission diagnostics. For config changes, require only `id`, `tokenFile`, and `outputDir`; reject attempts to reintroduce project-owned Theme combinations/order/limits.

For build changes, review normalized output/path collision handling, transformed CSS name collisions, selectors, alias preservation, deterministic JSON, and manifest shape. For delivery changes, verify repository/branch/source/destination safety and that current targets map CSS only.

## Onboarding checklist

- canonical file exists and passes shared submission validation;
- project ID/output directory are unique and repository-relative;
- derived permutations are at most 20;
- target source exactly matches output directory;
- CSS destination does not overlap another target mapping;
- two consecutive builds produce identical trees;
- dry-run lists only intended CSS paths;
- target maintainers know how to select `data-color-scheme` and review the PR.

## Release evidence

Run under Node 22: tests, typecheck, token validation, artifact build, and delivery dry-run. Retain CI logs plus central JSON/manifest artifacts long enough to diagnose a target issue. A green narrow test is not enough for a selector, manifest, or delivery-contract change.

## Incident response

Stop delivery when artifacts are ambiguous or the wrong target mapping appears. Use the manifest to identify the context, resolved JSON to verify the effective value, CSS to verify representation, and shared diagnostics/provenance to trace the canonical source. Fix canonical input or central code, rebuild, and open a new reviewed target change; do not hand-edit delivered CSS.
