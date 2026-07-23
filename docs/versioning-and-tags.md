# Project-output versions and tags

Every project stores one independent stable SemVer version in `projects.config.json`:

```json
{
  "id": "portal",
  "version": "2.0.0"
}
```

Its release tag is:

```text
portal-v2.0.0
```

The package version, ZIP version, changelog section, and tag must match. Canonical token files do not store a version. Plugin, Validator, Central, and other project versions do not control this value.

Update the version and changelog through review, merge them into `main`, then create the tag manually. CI never calculates, changes, or creates a version or tag.
