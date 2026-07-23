# Project-output rollback and recovery

Do not delete, move, or replace an approved package version or project ZIP release. A consumer rolls back by installing the previous approved package version and restoring the related CSS import.

If a release fails after its tag is pushed, inspect the exact tagged commit, GitHub Package, and GitHub Release state. Do not overwrite incomplete or incorrect outputs. Prepare a new reviewed version and tag.

If Validator installation fails, check `GITLAB_HOST`, `VALIDATOR_PROJECT_ID`, the read-only Deploy Token, and the exact dependency version. Do not use a local tarball fallback.
