# Project build information

Every full project ZIP contains `BUILD_INFO.json`. It records:

- project ID and package name;
- documentation slug;
- independent project-output version and tag;
- Central version and commit;
- exact Validator version;
- exact GitHub Packages install spec;
- local `.tgz` and full `.zip` names;
- CSS output paths and Theme records.

The full ZIP also contains `checksums.txt`:

```text
<sha256>  <relative-file-path>
```

Lines are sorted by relative path. The file covers `package/`, `storybook/`, and `BUILD_INFO.json`. It does not hash itself.

The GitHub Release description uses the matching project changelog section. The ZIP contains `BUILD_INFO.json` and `checksums.txt`; no separate manifest or checksum asset is uploaded.
