# EKN Central Tokens

Central validates designer-owned canonical `tokens.json` files, builds deterministic artifacts, and proposes CSS-only delivery to target repositories. It does not redefine token semantics: the same `@eknvn/token-validator` used by Token Architect resolves Set order, Theme states, aliases, and effective values.

```text
tokens.json
  → duplicate-key parse + shared submission validation
  → Theme contexts derived from canonical $themes
  → shared effective token graph
  → Style Dictionary naming/transforms
  → central CSS + resolved JSON + manifest
  → CSS-only target pull request
```

## Configuration split

Designers own token definitions, Theme IDs/groups/order, and Set states in `tokens.json`. Developers configure only where a project lives, where central artifacts are written, and where CSS is delivered.

Configuration references:

- [`projects.config.json`](docs/project-configuration.md) — required project fields, generated directories, Theme paths, and validation failures.
- [`targets.config.json`](docs/target-delivery.md) — target repositories, destinations, delivery defaults, dry-run/apply commands, and troubleshooting.
- [Setup walkthroughs](docs/configuration-examples.md) — add a project and deliver it to a target repository.

Theme combinations and Theme Group order come from the canonical `$themes` data rather than project configuration. See the references above for the exact supported fields and defaults.

## Artifacts and delivery

Central deliberately writes CSS, resolved JSON, and `manifest.json` under each `dist/<project>` directory. JSON and the manifest are internal evidence for debugging, tests, provenance, and delivery planning. Target repositories receive CSS only because `targets.config.json` declares only `destination.css`.

Removing `destination.json` and `destination.manifest` is sufficient: delivery mappings are created only for configured destinations, and a test proves existing central JSON/manifest files are not copied in a CSS-only plan.

## CSS alias strategy

Simple canonical aliases remain relationships in CSS:

```css
--color-primary: #0055ff;
--button-background: var(--color-primary);
```

Resolved JSON records `button.background` as `#0055ff`. Preserving `var()` in CSS supports runtime override and debugging; resolved JSON supports deterministic validation. Literal values and composite/embedded values that cannot be represented as one safe custom-property reference are emitted statically.

## Commands

Use Node 22 from `.nvmrc`:

```sh
nvm use
npm install
npm test
npm run typecheck
npm run validate:tokens
npm run build:artifacts
npm run delivery:target-mr
```

Delivery defaults to dry-run unless CI/apply configuration authorizes repository changes. Start with the [documentation index](docs/README.md) for architecture, config contracts, artifacts, delivery, operations, and troubleshooting.
