import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildProject } from "../scripts/build-token-artifacts.js";
import { buildProjectPackage } from "../scripts/build-project-package.js";
import { writeGuide } from "../scripts/build-project-storybook.js";
import { getSelectedProjects } from "../scripts/lib/project-selection.js";
import { validateProjectsConfig } from "../scripts/validate-token-projects.js";
import type { TokenDocument, TokenProject } from "../scripts/lib/types.js";

const sourceRoot = process.cwd();

test("Central has an independent informational version", () => {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(sourceRoot, "package.json"), "utf8"),
  ) as { name: string; version: string; private: boolean };
  assert.deepEqual(
    {
      name: metadata.name,
      version: metadata.version,
      private: metadata.private,
    },
    {
      name: "design-token-central",
      version: "0.1.0",
      private: true,
    },
  );
});

function document(color = "#0055ff"): TokenDocument {
  return {
    base: {
      color: {
        primary: { type: "color", value: color, description: "Brand color" },
      },
      spacing: { small: { type: "dimension", value: "4px" } },
      button: { background: { type: "color", value: "{color.primary}" } },
    },
    dark: { color: { primary: { type: "color", value: "#111111" } } },
    $themes: [
      {
        id: "brand",
        name: "Brand",
        group: "Brand",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "light",
        name: "Light",
        group: "Mode",
        selectedTokenSets: { base: "enabled", dark: "disabled" },
      },
      {
        id: "dark",
        name: "Dark",
        group: "Mode",
        selectedTokenSets: { dark: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base", "dark"] },
  };
}
function fixture(root: string, id = "fixture"): TokenProject {
  const project = {
    id,
    tokenFile: `token-definitions/projects/${id}/tokens.json`,
    outputDir: `dist/${id}`,
    packageName: `@ekinotech/design-tokens-${id}`,
    version: "0.1.0",
    documentationSlug: id,
    enabled: true,
  };
  fs.mkdirSync(path.dirname(path.join(root, project.tokenFile)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, project.tokenFile),
    JSON.stringify(document()),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "design-token-central",
      version: "0.1.0",
      private: true,
    }),
  );
  return project;
}
function tree(root: string, prefix = ""): string[] {
  if (!fs.existsSync(path.join(root, prefix))) return [];
  return fs
    .readdirSync(path.join(root, prefix), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? tree(root, path.posix.join(prefix, entry.name))
        : [path.posix.join(prefix, entry.name)],
    )
    .sort();
}

test("project config validates unique package metadata and safe isolated paths", () => {
  const first = {
    id: "a",
    tokenFile: "token-definitions/projects/a/tokens.json",
    outputDir: "dist/a",
    packageName: "@ekinotech/design-tokens-a",
    version: "0.1.0",
    documentationSlug: "a",
    enabled: true,
  };
  assert.doesNotThrow(() => validateProjectsConfig({ projects: [first] }));
  assert.throws(
    () => validateProjectsConfig({ projects: [first, { ...first, id: "b" }] }),
    /packageName.*duplicates/,
  );
  assert.throws(
    () =>
      validateProjectsConfig({
        projects: [
          first,
          {
            ...first,
            id: "b",
            tokenFile: "token-definitions/projects/b/tokens.json",
            outputDir: "dist/b",
            packageName: "@ekinotech/design-tokens-b",
          },
        ],
      }),
    /documentationSlug.*duplicates/,
  );
  assert.throws(
    () =>
      validateProjectsConfig({
        projects: [{ ...first, outputDir: "../outside" }],
      }),
    /safe repository-relative/,
  );
  assert.throws(
    () =>
      validateProjectsConfig({
        projects: [
          first,
          {
            id: "ab",
            tokenFile: "x/tokens.json",
            outputDir: "dist/a/child",
            packageName: "@ekinotech/design-tokens-ab",
            version: "0.1.0",
            documentationSlug: "ab",
            enabled: true,
          },
        ],
      }),
    /overlaps/,
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-config-"));
  assert.throws(
    () => validateProjectsConfig({ projects: [first] }, root),
    /does not exist for enabled project/,
  );
  const disabled = {
    ...first,
    enabled: false,
    disabledReason: "Canonical tokens are not ready.",
  };
  assert.doesNotThrow(() =>
    validateProjectsConfig({ projects: [disabled] }, root),
  );
  assert.throws(
    () => getSelectedProjects([disabled], new Set([disabled.id])),
    /is disabled: Canonical tokens are not ready/,
  );
});

test("raw artifacts remain isolated and deterministic", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-raw-"));
  const project = fixture(root);
  fs.mkdirSync(path.join(root, project.outputDir), { recursive: true });
  fs.writeFileSync(path.join(root, project.outputDir, "obsolete.css"), "old");
  await buildProject(project, root);
  const first = tree(path.join(root, project.outputDir));
  await buildProject(project, root);
  assert.deepEqual(tree(path.join(root, project.outputDir)), first);
  assert.deepEqual(first, [
    "raw/brand/dark.css",
    "raw/brand/dark.json",
    "raw/brand/light.css",
    "raw/brand/light.json",
    "raw/manifest.json",
  ]);
  assert.equal(
    fs.existsSync(path.join(root, project.outputDir, "obsolete.css")),
    false,
  );
  assert.match(
    fs.readFileSync(
      path.join(root, project.outputDir, "raw/brand/light.css"),
      "utf8",
    ),
    /--button-background: var\(--color-primary\)/,
  );
});

test("generated tgz installs from a path and URL and exposes only its own CSS", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-package-"));
  const project = fixture(root, "havas-network-websites");
  const paths = await buildProjectPackage(project, {
    root,
    version: "0.4.0-rc.2",
    sourceCommit: "abc123",
  });
  const tarball = path.join(paths.packagesDir, paths.packageAsset);
  assert.equal(
    execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).includes(
      "storybook",
    ),
    false,
  );
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-consumer-"));
  fs.writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  execFileSync(
    "npm",
    [
      "install",
      tarball,
      "--ignore-scripts",
      "--cache",
      path.join(root, ".npm"),
    ],
    { cwd: consumer, stdio: "pipe" },
  );
  const installed = path.join(
    consumer,
    "node_modules/@ekinotech/design-tokens-havas-network-websites",
  );
  const metadata = JSON.parse(
    fs.readFileSync(path.join(installed, "package.json"), "utf8"),
  );
  assert.equal(
    metadata.name,
    "@ekinotech/design-tokens-havas-network-websites",
  );
  assert.equal(metadata.version, "0.4.0-rc.2");
  const buildMetadata = JSON.parse(
    fs.readFileSync(path.join(installed, "project-build.json"), "utf8"),
  ) as {
    centralVersion: string;
    centralCommit: string;
    validatorVersion: string;
  };
  assert.deepEqual(buildMetadata, {
    ...buildMetadata,
    centralVersion: "0.1.0",
    centralCommit: "abc123",
    validatorVersion: "0.1.0",
  });
  assert.equal(
    fs.existsSync(path.join(installed, "css/brand/light.css")),
    true,
  );
  assert.equal(
    tree(installed).some(
      (file) => file.includes("tokens.json") || file.includes("unrelated"),
    ),
    false,
  );
  assert.equal(
    execFileSync(
      process.execPath,
      [
        "-e",
        "console.log(require.resolve('@ekinotech/design-tokens-havas-network-websites/brand/light.css'))",
      ],
      { cwd: consumer, encoding: "utf8" },
    )
      .trim()
      .endsWith("css/brand/light.css"),
    true,
  );

  const urlConsumer = fs.mkdtempSync(
    path.join(os.tmpdir(), "tokens-url-consumer-"),
  );
  fs.writeFileSync(
    path.join(urlConsumer, "package.json"),
    JSON.stringify({ name: "url-consumer", private: true }),
  );
  execFileSync(
    "npm",
    [
      "install",
      pathToFileURL(tarball).href,
      "--ignore-scripts",
      "--cache",
      path.join(root, ".npm"),
    ],
    { cwd: urlConsumer, stdio: "pipe" },
  );
  const installedFromUrl = JSON.parse(
    fs.readFileSync(
      path.join(
        urlConsumer,
        "node_modules/@ekinotech/design-tokens-havas-network-websites/package.json",
      ),
      "utf8",
    ),
  ) as { name: string; version: string };
  assert.equal(
    installedFromUrl.name,
    "@ekinotech/design-tokens-havas-network-websites",
  );
  assert.equal(installedFromUrl.version, "0.4.0-rc.2");

  const repeated = await buildProjectPackage(project, {
    root,
    version: "0.4.0-rc.2",
    sourceCommit: "abc123",
  });
  assert.equal(
    fs.existsSync(path.join(repeated.packagesDir, repeated.packageAsset)),
    true,
  );
  assert.deepEqual(tree(repeated.packagesDir), [repeated.packageAsset]);
});

test("Storybook guide uses shared resolved values and matching package version", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-guide-"));
  const project = fixture(root, "havas-network-websites");
  await buildProjectPackage(project, {
    root,
    version: "0.2.0",
    sourceCommit: "deadbeef",
  });
  fs.mkdirSync(path.join(root, "storybook"));
  writeGuide(project, { root, version: "0.2.0", sourceCommit: "deadbeef" });
  const guide = fs.readFileSync(
    path.join(root, "storybook/generated-guide.mjs"),
    "utf8",
  );
  assert.match(guide, /"version": "0.2.0"/);
  assert.match(guide, /"centralVersion": "0.1.0"/);
  assert.match(guide, /"centralCommit": "deadbeef"/);
  assert.match(guide, /"resolvedValue": "#111111"/);
  assert.match(guide, /"winningSet": "dark"/);
  assert.match(guide, /"aliasTarget": "color.primary"/);
});

test("generated project tree never includes another project", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-isolation-"));
  const first = fixture(root, "first");
  fixture(root, "second");
  const paths = await buildProjectPackage(first, {
    root,
    version: "0.1.0",
    sourceCommit: "abc",
  });
  assert.equal(
    tree(paths.projectDir).some((file) => file.includes("second")),
    false,
  );
});
