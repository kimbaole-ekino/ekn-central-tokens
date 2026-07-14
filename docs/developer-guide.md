# Developer guide

## Setup

Use the exact supported major:

```sh
nvm use
npm install
npm test
npm run typecheck
```

`.nvmrc`, `package.json`, and CI all target Node 22. Do not use a passing Node 20 run as release evidence.

## Normal change loop

1. Start with a failing public-behavior test.
2. Make the smallest central change while leaving canonical semantics in the shared validator.
3. Run focused tests, then full tests/typecheck/validation/build.
4. Inspect generated CSS, resolved JSON, and manifest for a real configured project.
5. Run delivery dry-run and confirm only intended CSS mappings.
6. Update reference docs when a config, selector, path, manifest, or delivery contract changes.

## Common tasks

To add a project, follow [project configuration](project-configuration.md). To change canonical semantics, change and publish the shared validator first, with parity tests in both repos. To add an artifact format, define whether it is central-only or target-delivered and add explicit destination validation; never infer delivery from files merely existing in `dist`.

## Validator UAT releases

UAT must exercise the registry package boundary, not the adjacent workspace through a `file:` dependency or symlink. Publish the public `@eknvn/token-validator` prerelease with the `uat` dist-tag, replace Central's dependency with the exact prerelease version, run `npm install`, and commit both `package.json` and `package-lock.json`. Verify with Node 22 using `npm test`, `npm run typecheck`, and the relevant artifact build before promoting the release.

## CSS changes

Treat selectors, custom-property names, alias/static representation, and nested paths as consumer APIs. A change needs an artifact test and target coordination. Preserve simple alias relationships as `var(--target)` after transformed-name collision checks; keep JSON resolved.

## Working tree safety

Canonical token files may contain concurrent designer changes. Do not normalize or replace them as a side effect of config work. Generated `dist` is disposable, but project config and token definitions are reviewed source.
