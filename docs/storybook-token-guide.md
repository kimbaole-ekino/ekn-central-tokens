# Storybook token guide

Central uses one shared Storybook 10 HTML/Vite template. Every project builds an independent read-only site from canonical data and the shared validator graph.

The guide includes Overview, Token Sets, Themes and Theme Groups, Colors, Typography, Spacing and sizing, Radius and borders, Shadows and opacity, Aliases, and Developer usage. Token rows show name, type, raw and resolved values, alias target, source and winning Set, CSS variable, and description.

```sh
npm run storybook -- --project=<enabled-project-id> --version=0.1.0
npm run build:storybook -- --project=<enabled-project-id> --version=0.1.0
```

Static output goes to `dist/<project>/storybook-static/`. Its `project-build.json` records the same project version as the generated package. A project-output release includes this site under `storybook/` in the full ZIP. Central does not deploy the site.

Storybook telemetry is disabled. A Storybook failure fails the local build.
