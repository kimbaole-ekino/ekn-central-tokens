# Maintainer guide

1. Review canonical intent and affected-project previews before merge.
2. Run validation, type checking, package generation, and Storybook generation.
3. Inspect package metadata, CSS exports, and Storybook output.
4. Test the `.tgz` in a clean temporary consumer.
5. Update the project version and changelog, then inspect the local `.tgz`, full `.zip`, `BUILD_INFO.json`, and checksums before creating the tag.

Central records its commit SHA in generated project metadata. A shared tooling change may affect every project.

Do not create a GitHub Release for Central itself, publish Central to npm, or add target credentials. A project-output release starts only from a reviewed `<project-id>-v<version>` tag.
