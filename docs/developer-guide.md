# Developer guide

## Setup

Use Node 22 from `.nvmrc`:

```sh
nvm use
npm install
npm test
npm run typecheck
```

`package.json` and CI also use Node 22. A passing run on another Node version is not release proof.

## Normal change process

1. Add a test that shows the required behavior.
2. Make the smallest safe Central change. Keep token rules in the shared validator.
3. Run focused tests, then the full test, typecheck, validation, and build commands.
4. Check CSS, resolved JSON, and the manifest for a real project.
5. Run delivery in dry-run mode and check every CSS mapping.
6. Update the docs when a path, selector, manifest, configuration, or delivery rule changes.

## Common work

Use [project configuration](project-configuration.md) to add a project. Change canonical token rules in the shared validator first, publish it, and test both clients.

Before adding a new artifact type, decide if it stays in Central or goes to targets. Add an exact target destination and tests. Do not deliver a file only because it exists in `dist/`.

## Validator UAT releases

Test the real package registry path. Publish `@eknvn/token-validator` with the agreed `uat` tag. Install that exact version in Central and commit both package files.

Do not use a nearby `file:` dependency or link as release proof. Run Central tests, typecheck, and a real artifact build with Node 22.

## CSS changes

Selectors, CSS variable names, reference output, and nested paths are target APIs. Add an artifact test and tell target maintainers before changing them.

Keep a simple safe reference as `var(--target)`. Keep resolved JSON fully resolved.

## Working tree safety

Canonical files may include designer work. Do not rewrite them during an unrelated config change. `dist/` is generated and can be replaced, but configuration and token source files need review.
