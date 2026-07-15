import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  resolveActiveThemeContext,
  resolveEffectiveTokens,
} from "@eknvn/token-validator";
import {
  buildProject,
  derivedContexts,
  normalizeOutputId,
} from "../scripts/build-token-artifacts.js";
import { copyArtifactsRecursively } from "../scripts/lib/copy-artifacts.js";
import { getDeliveryMappings } from "../scripts/lib/delivery-mappings.js";
import { buildEffectiveGraphWithStyleDictionary } from "../scripts/lib/style-dictionary.js";
import { readTokenDocument } from "../scripts/lib/token-utils.js";
import {
  validateProjectsConfig,
  validateTargetsConfig,
} from "../scripts/validate-token-projects.js";
import type {
  DeliveryConfig,
  ProjectsConfig,
  TokenDocument,
  TokenProject,
} from "../scripts/lib/types.js";

function document(): TokenDocument {
  return {
    base: {
      color: { primary: { type: "color", value: "#0055ff" } },
    },
    dark: {
      color: { primary: { type: "color", value: "#111111" } },
    },
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
        group: "Color mode",
        selectedTokenSets: { base: "enabled", dark: "disabled" },
      },
      {
        id: "dark",
        name: "Dark",
        group: "Color mode",
        selectedTokenSets: { dark: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base", "dark"] },
  };
}

function temporaryProject(root: string): TokenProject {
  fs.mkdirSync(path.join(root, "tokens"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    `${JSON.stringify(document(), null, 2)}\n`,
  );
  return {
    id: "fixture",
    tokenFile: "tokens/tokens.json",
    outputDir: "dist/fixture",
  };
}

function readTree(root: string, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of fs.readdirSync(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, readTree(root, relative));
    else result[relative] = fs.readFileSync(path.join(root, relative), "utf8");
  }
  return result;
}

test("Theme contexts and group order are derived from tokens.json", () => {
  assert.deepEqual(
    derivedContexts(document(), "fixture").map((context) =>
      context.themes.map((theme) => theme.id),
    ),
    [
      ["brand", "light"],
      ["brand", "dark"],
    ],
  );
});

test("project config rejects fields outside the current schema", () => {
  const project = {
    id: "fixture",
    tokenFile: "tokens/tokens.json",
    outputDir: "dist/fixture",
    legacyOption: true,
  };
  assert.throws(
    () => validateProjectsConfig({ projects: [project] }, new Set()),
    /legacyOption is not a recognized field/,
  );
});

test("derived Theme permutations have a fixed safety ceiling", () => {
  const manyThemes: TokenDocument = {
    base: { number: { type: "number", value: 1 } },
    $themes: Array.from({ length: 5 }, (_, groupIndex) =>
      ["a", "b"].map((name) => ({
        id: `g${groupIndex}-${name}`,
        name,
        group: `G${groupIndex}`,
        selectedTokenSets: { base: "enabled" as const },
      })),
    ).flat(),
    $metadata: { tokenSetOrder: ["base"] },
  };
  assert.throws(
    () => derivedContexts(manyThemes, "fixture"),
    /fixture.*20.*Theme permutations/,
  );
});

test("Style Dictionary builds the shared effective graph and blocks transformed name collisions", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tokens-style-dictionary-"),
  );
  const collisionDocument: TokenDocument = {
    base: {
      foo: {
        bar: { type: "number", value: 1 },
      },
      "foo-bar": { type: "number", value: 2 },
    },
    $themes: [
      {
        id: "default",
        name: "Default",
        group: "Mode",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  const context = resolveActiveThemeContext(collisionDocument, {
    Mode: "default",
  });
  const graph = resolveEffectiveTokens(collisionDocument, context);
  await assert.rejects(
    buildEffectiveGraphWithStyleDictionary({
      graph,
      outputDir: root,
      outputId: "default",
    }),
    /TRANSFORMED_OUTPUT_COLLISION.*base.*default/,
  );
});

test("CSS preserves simple aliases as custom-property references while JSON stays resolved", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-css-alias-"));
  const aliasDocument: TokenDocument = {
    base: {
      color: { primary: { type: "color", value: "#0055ff" } },
      button: {
        background: { type: "color", value: "{color.primary}" },
      },
    },
    $themes: [
      {
        id: "default",
        name: "Default",
        group: "Mode",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  const graph = resolveEffectiveTokens(
    aliasDocument,
    resolveActiveThemeContext(aliasDocument, { Mode: "default" }),
  );
  await buildEffectiveGraphWithStyleDictionary({
    graph,
    outputDir: root,
    outputId: "default",
  });
  assert.match(
    fs.readFileSync(path.join(root, "default.css"), "utf8"),
    /--button-background: var\(--color-primary\);/,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "default.json"), "utf8"))[
      "button.background"
    ].value,
    "#0055ff",
  );
});

test("artifact files and manifest are deterministic and remain inside the project output", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-artifacts-"));
  const project = temporaryProject(root);
  await buildProject(project, root);
  const output = path.join(root, project.outputDir);
  const first = readTree(output);
  await buildProject(project, root);
  const second = readTree(output);
  assert.deepEqual(second, first);
  const manifest = JSON.parse(first["manifest.json"]!) as {
    projectId: string;
    outputs: Record<
      string,
      {
        themes: Array<{ group: string; id: string; name: string }>;
        css: string;
        json: string;
      }
    >;
  };
  assert.equal(manifest.projectId, "fixture");
  for (const [outputId, entry] of Object.entries(manifest.outputs)) {
    assert.equal(outputId.length > 0, true);
    assert.equal(entry.themes.length, 2);
    for (const file of [entry.css, entry.json]) {
      const artifact = path.resolve(output, file);
      assert.equal(artifact.startsWith(`${output}${path.sep}`), true);
      assert.equal(fs.existsSync(artifact), true);
    }
  }
  assert.deepEqual(Object.keys(first).sort(), [
    "brand/dark.css",
    "brand/dark.json",
    "brand/light.css",
    "brand/light.json",
    "manifest.json",
  ]);
  assert.match(
    first["brand/light.css"]!,
    /:root\[data-color-scheme="brand-light"\],\n\[data-color-scheme="brand-light"\]/,
  );
  await assert.rejects(
    buildProject({ ...project, outputDir: "../outside" }, root),
    /must remain inside the repository/,
  );
});

test("artifact CLI initializes its permutation limit before invoking main", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-artifact-cli-"));
  const project = temporaryProject(root);
  fs.writeFileSync(
    path.join(root, "projects.config.json"),
    JSON.stringify({ projects: [project] }),
  );
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules/tsx/dist/cli.mjs"),
      path.resolve("scripts/build-token-artifacts.ts"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    fs.existsSync(path.join(root, "dist/fixture/manifest.json")),
    true,
  );
});

test("token validation checks only the selected project's canonical file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-validation-cli-"));
  const project = temporaryProject(root);
  fs.writeFileSync(
    path.join(root, "projects.config.json"),
    JSON.stringify({
      projects: [
        project,
        {
          id: "unrelated",
          tokenFile: "tokens/unrelated/tokens.json",
          outputDir: "dist/unrelated",
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(root, "targets.config.json"),
    JSON.stringify({ targets: [] }),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules/tsx/dist/cli.mjs"),
      path.resolve("scripts/validate-token-projects.ts"),
      "--project=fixture",
    ],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 1 token file\(s\)\./);
});

test("project configuration without tokens.json does not fail validation, build, or delivery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-first-sync-"));
  const project: TokenProject = {
    id: "pending",
    tokenFile: "tokens/pending/tokens.json",
    outputDir: "dist/pending",
  };
  fs.writeFileSync(
    path.join(root, "projects.config.json"),
    JSON.stringify({ projects: [project] }),
  );
  fs.writeFileSync(
    path.join(root, "targets.config.json"),
    JSON.stringify({
      targets: [
        {
          project: "pending",
          repo: "https://github.com/example/pending.git",
          branch: "main",
          source: "dist/pending",
          destination: { css: "src/styles/generated-tokens" },
        },
      ],
    }),
  );

  for (const [script, expectedOutput] of [
    ["validate-token-projects.ts", "Skipped 1 project(s) without tokens.json."],
    ["build-token-artifacts.ts", "waiting for tokens/pending/tokens.json."],
    [
      "create-target-merge-requests.ts",
      "No configured projects with tokens.json are ready for target delivery.",
    ],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        path.resolve("node_modules/tsx/dist/cli.mjs"),
        path.resolve("scripts", script),
        "--project=pending",
      ],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout.includes(expectedOutput), true, result.stdout);
  }
  assert.equal(fs.existsSync(path.join(root, project.outputDir)), false);
});

test("tokens.json without project configuration is still validated", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-unregistered-"));
  const tokenDir = path.join(root, "token-definitions/projects/unregistered");
  fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(
    path.join(tokenDir, "tokens.json"),
    JSON.stringify(document()),
  );
  fs.writeFileSync(
    path.join(root, "projects.config.json"),
    JSON.stringify({ projects: [] }),
  );
  fs.writeFileSync(
    path.join(root, "targets.config.json"),
    JSON.stringify({ targets: [] }),
  );

  const runValidation = () =>
    spawnSync(
      process.execPath,
      [
        path.resolve("node_modules/tsx/dist/cli.mjs"),
        path.resolve("scripts/validate-token-projects.ts"),
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          TOKEN_PROJECTS: "",
          TOKEN_VALIDATION_PROJECTS: "unregistered",
        },
      },
    );

  const validResult = runValidation();
  assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);
  assert.equal(
    validResult.stdout.includes("waiting for project configuration"),
    true,
    validResult.stdout,
  );
  assert.equal(
    validResult.stdout.includes("Validated 1 token file(s)."),
    true,
    validResult.stdout,
  );

  fs.writeFileSync(path.join(tokenDir, "tokens.json"), "{");
  const invalidResult = runValidation();
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /failed parsing/);
});

test("one Theme Group with multiple Themes creates flat artifact paths", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-nested-groups-"));
  const tokenDocument: TokenDocument = {
    base: {
      color: {
        optional: { type: "color", value: "" },
        primary: { type: "color", value: "#0055ff" },
      },
    },
    $themes: [
      {
        id: "creative",
        name: "Creative",
        group: "Brand",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "react",
        name: "React",
        group: "Platform",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "dark",
        name: "Dark",
        group: "Color mode",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  fs.mkdirSync(path.join(root, "tokens"));
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify(tokenDocument),
  );
  const oneGroupDocument: TokenDocument = {
    ...tokenDocument,
    $themes: [tokenDocument.$themes![2]!],
  };
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify(oneGroupDocument),
  );
  const oneGroup: TokenProject = {
    id: "one",
    tokenFile: "tokens/tokens.json",
    outputDir: "dist/one",
  };
  await buildProject(oneGroup, root);
  assert.deepEqual(Object.keys(readTree(path.join(root, "dist/one"))).sort(), [
    "dark.css",
    "dark.json",
    "manifest.json",
  ]);

  const lightTheme = {
    ...tokenDocument.$themes![2]!,
    id: "light",
    name: "Light",
  };
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify({
      ...tokenDocument,
      $themes: [lightTheme, tokenDocument.$themes![2]!],
    }),
  );
  await buildProject(oneGroup, root);
  const flatTree = readTree(path.join(root, "dist/one"));
  assert.deepEqual(Object.keys(flatTree).sort(), [
    "dark.css",
    "dark.json",
    "light.css",
    "light.json",
    "manifest.json",
  ]);
  assert.match(
    flatTree["light.css"]!,
    /:root\[data-color-scheme="light"\],\n\[data-color-scheme="light"\]/,
  );
});

test("multiple Theme Groups preserve nested artifact paths", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-nested-groups-"));
  const tokenDocument: TokenDocument = {
    base: {
      color: {
        optional: { type: "color", value: "" },
        primary: { type: "color", value: "#0055ff" },
      },
    },
    $themes: [
      {
        id: "creative",
        name: "Creative",
        group: "Brand",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "campaign",
        name: "Campaign",
        group: "Brand",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "react",
        name: "React",
        group: "Platform",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "dark",
        name: "Dark",
        group: "Color mode",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  fs.mkdirSync(path.join(root, "tokens"));

  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify(tokenDocument),
  );
  const threeGroups: TokenProject = {
    id: "three",
    tokenFile: "tokens/tokens.json",
    outputDir: "dist/three",
  };
  await buildProject(threeGroups, root);
  const tree = readTree(path.join(root, "dist/three"));
  assert.equal(tree["creative/react/dark.css"] !== undefined, true);
  assert.equal(tree["campaign/react/dark.css"] !== undefined, true);
  assert.equal(tree["creative/react/dark.json"] !== undefined, true);
  assert.match(tree["creative/react/dark.css"]!, /--color-optional: ;/);
  assert.deepEqual(Object.keys(JSON.parse(tree["manifest.json"]!).outputs), [
    "creative-react-dark",
    "campaign-react-dark",
  ]);
  assert.equal(
    JSON.parse(tree["manifest.json"]!).outputs["creative-react-dark"].css,
    "creative/react/dark.css",
  );
});

test("normalized output IDs reject unsafe names and expose filename equivalence", () => {
  assert.equal(normalizeOutputId("Ekino Light"), "ekino-light");
  assert.equal(normalizeOutputId("Ekino-Light"), "ekino-light");
  assert.throws(() => normalizeOutputId("..."), /Unsafe output ID/);
});

test("central parses raw JSON through the shared duplicate-key contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-parse-"));
  const file = path.join(root, "tokens.json");
  fs.writeFileSync(
    file,
    '{"base":{"color":{"primary":{"type":"color","value":"#fff"},"primary":{"type":"color","value":"#000"}}}}',
  );
  assert.throws(() => readTokenDocument(file), /TOKEN_PATH_DUPLICATE/);
});

test("target validation blocks same and nested destinations across artifact types", () => {
  const projects: ProjectsConfig = {
    projects: [
      { id: "a", tokenFile: "a/tokens.json", outputDir: "dist/a" },
      { id: "b", tokenFile: "b/tokens.json", outputDir: "dist/b" },
    ],
  };
  assert.throws(
    () =>
      validateTargetsConfig(
        {
          targets: [
            {
              project: "a",
              repo: "owner/repo",
              branch: "main",
              source: "dist/a",
              destination: { css: "src/tokens" },
            },
            {
              project: "b",
              repo: "owner/repo",
              branch: "main",
              source: "dist/b",
              destination: {
                css: "src/other",
                json: "src/tokens/json",
              },
            },
          ],
        },
        projects,
        new Set(["a", "b"]),
      ),
    /conflicts with/,
  );
});

test("target validation rejects providers that are not implemented and invalid delivery options", () => {
  const projects: ProjectsConfig = {
    projects: [{ id: "a", tokenFile: "a/tokens.json", outputDir: "dist/a" }],
  };
  const target = {
    project: "a",
    repo: "owner/repo",
    branch: "main",
    source: "dist/a",
    destination: { css: "src/tokens" },
  };

  assert.throws(
    () =>
      validateTargetsConfig(
        {
          targets: [{ ...target, delivery: { provider: "gitlab" } }],
        },
        projects,
        new Set(["a"]),
      ),
    /provider must be "github"; provider gitlab is not implemented/,
  );
  assert.throws(
    () =>
      validateTargetsConfig(
        {
          targets: [{ ...target, delivery: { reviewers: ["team", 42] } }],
        },
        projects,
        new Set(["a"]),
      ),
    /reviewers must be an array of non-empty strings/,
  );
  assert.throws(
    () =>
      validateTargetsConfig(
        {
          targets: [
            {
              ...target,
              delivery: {
                provider: "github",
                removedOption: true,
              } as DeliveryConfig,
            },
          ],
        },
        projects,
        new Set(["a"]),
      ),
    /removedOption is not a recognized field/,
  );
});

test("target delivery preserves nested artifact paths and filters extensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-delivery-copy-"));
  const source = path.join(root, "source");
  const cssTarget = path.join(root, "css");
  const jsonTarget = path.join(root, "json");
  fs.mkdirSync(path.join(source, "creative/react"), { recursive: true });
  fs.writeFileSync(path.join(source, "light.css"), "flat css");
  fs.writeFileSync(path.join(source, "creative/react/light.css"), "css");
  fs.writeFileSync(path.join(source, "creative/react/light.json"), "json");
  fs.writeFileSync(path.join(source, "manifest.json"), "manifest");

  copyArtifactsRecursively(source, cssTarget, ".css");
  copyArtifactsRecursively(source, jsonTarget, ".json");

  assert.deepEqual(Object.keys(readTree(cssTarget)).sort(), [
    "creative/react/light.css",
    "light.css",
  ]);
  assert.deepEqual(Object.keys(readTree(jsonTarget)), [
    "creative/react/light.json",
  ]);
});

test("a CSS-only destination leaves central JSON and manifest out of delivery", () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-css-only-"));
  fs.writeFileSync(path.join(source, "light.css"), "css");
  fs.writeFileSync(path.join(source, "light.json"), "json");
  fs.writeFileSync(path.join(source, "manifest.json"), "manifest");

  assert.deepEqual(
    getDeliveryMappings(source, { css: "src/styles/tokens" }).map(
      (mapping) => ({
        label: mapping.label,
        destination: mapping.destination,
        extension: mapping.extension,
      }),
    ),
    [
      {
        label: "css",
        destination: "src/styles/tokens",
        extension: ".css",
      },
    ],
  );
});

test("identical selectors are allowed when final artifact paths differ", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tokens-filename-collision-"),
  );
  const collisionDocument: TokenDocument = {
    base: { number: { type: "number", value: 1 } },
    $themes: [
      {
        id: "g1-long",
        name: "A B",
        group: "G1",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "g1-short",
        name: "A",
        group: "G1",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "g2-short",
        name: "C",
        group: "G2",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "g2-long",
        name: "B C",
        group: "G2",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  fs.mkdirSync(path.join(root, "tokens"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify(collisionDocument),
  );
  await buildProject(
    {
      id: "collision",
      tokenFile: "tokens/tokens.json",
      outputDir: "dist/collision",
    },
    root,
  );
  const tree = readTree(path.join(root, "dist/collision"));
  assert.match(tree["a-b/c.css"]!, /data-color-scheme="a-b-c"/);
  assert.match(tree["a/b-c.css"]!, /data-color-scheme="a-b-c"/);
  const manifest = JSON.parse(tree["manifest.json"]!);
  assert.equal(manifest.outputs["a-b-c"].css, "a-b/c.css");
  assert.equal(manifest.outputs["a/b-c"].css, "a/b-c.css");
});

test("two Themes producing the same final artifact path fail", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tokens-theme-collision-"),
  );
  const collisionDocument: TokenDocument = {
    base: { number: { type: "number", value: 1 } },
    $themes: [
      {
        id: "site-a-light-spaced",
        name: "Site A Light",
        group: "Default",
        selectedTokenSets: { base: "enabled" },
      },
      {
        id: "site-a-light-hyphenated",
        name: "site-a-light",
        group: "Default",
        selectedTokenSets: { base: "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["base"] },
  };
  fs.mkdirSync(path.join(root, "tokens"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tokens/tokens.json"),
    JSON.stringify(collisionDocument),
  );
  await assert.rejects(
    buildProject(
      {
        id: "collision",
        tokenFile: "tokens/tokens.json",
        outputDir: "dist/collision",
      },
      root,
    ),
    /Theme output collision: both themes generate site-a-light\.css/,
  );
});
