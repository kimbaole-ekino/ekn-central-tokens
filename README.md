# EKN Central Tokens

Central checks canonical `tokens.json`, builds stable artifacts, and prepares delivery to target repositories. It does not define a second token model.

This repository documents Central-owned behavior only. Read the [overall product architecture](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/project/architecture.md) and [end-to-end workflow](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/project/end-to-end-workflow.md) in the Token Architect repository for the complete system.

Token Architect and Central use the same `@eknvn/token-validator` package for Set order, Theme states, references, and effective values.

```text
tokens.json
  -> duplicate-key and submission checks
  -> Theme contexts from canonical $themes
  -> shared effective token graph
  -> Style Dictionary and Tokens Studio transforms
  -> CSS, resolved JSON, and manifest
  -> target pull request
```

## Configuration

Designers own token values, references, Set order, Set states, and Themes in `tokens.json`.

Central developers configure:

- where each token project lives;
- where Central writes generated output;
- which target repository receives that output;
- which generated file types are delivered.

Read:

- [Project configuration](docs/project-configuration.md) for `projects.config.json` fields and errors.
- [Target delivery](docs/target-delivery.md) for `targets.config.json`, dry-run, apply mode, and safety rules.
- [Configuration examples](docs/configuration-examples.md) for full setup steps.

Theme Groups, Theme order, and valid Theme combinations come from canonical `$themes`. They do not belong in project config.

## Artifacts and delivery

Central writes generated files under each `dist/<project>` folder:

- CSS for target use;
- resolved JSON for checks and problem solving;
- `manifest.json` for file mapping and delivery plans.

One Theme Group creates flat files such as `light.css`. Several Theme Groups create nested paths from selected Theme names.

A target receives only the configured artifact types. When it has only `destination.css`, resolved JSON and the manifest stay in Central.

Apply mode deletes and recreates each listed target destination. These folders must contain generated files only. Delivery starts as a dry-run and never merges a target pull request.

## CSS references

Central keeps a simple direct reference as a CSS variable link when it is safe:

```css
--color-primary: #0055ff;
--button-background: var(--color-primary);
```

Resolved JSON stores the final value. Central writes a fixed CSS value for complex, embedded, unsupported, or unsafe references.

## Commands

Use Node 22 from `.nvmrc`:

```sh
nvm use
npm install
npm test
npm run typecheck
npm run validate:tokens -- --project=site-a
npm run build:artifacts -- --project=site-a
npm run delivery:target-mr -- --project=site-a
```

Remove `--project` to validate every registered and found canonical token file. Build and delivery only use registered projects that also have `tokens.json`.

Delivery is a dry-run unless apply mode is clearly enabled. Start with the [Central documentation index](docs/README.md) for architecture, artifacts, delivery, maintenance, and problem solving.
