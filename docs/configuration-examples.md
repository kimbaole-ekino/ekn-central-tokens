# Configuration examples

Add a project with all required build metadata, then validate only it:

```sh
npm run validate:tokens -- --project=site-a
npm run build:packages -- --project=site-a --version=0.1.0
npm run build:storybook -- --project=site-a --version=0.1.0
```

Invalid examples include `../tokens.json`, overlapping output paths, duplicate package names, duplicate documentation slugs, a package name that does not match the project ID, an enabled project without canonical data, and a disabled project without a reason. There is no target repository configuration in Central.
