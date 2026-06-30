import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import StyleDictionary from "style-dictionary";
import { propertyFormatNames } from "style-dictionary/enums";
import { formattedVariables } from "style-dictionary/utils";
import { register as registerTokensStudioTransforms } from "@tokens-studio/sd-transforms";
import {
  getProjectsConfig,
  readJson,
  renderTemplate,
  validateTokenDocument,
  writeFile,
} from "./token-build-utils.mjs";

const GENERATED_FILE_HEADER =
  "/* Do not edit directly, this file was auto-generated. */";
const rootDir = process.cwd();
const config = getProjectsConfig(rootDir);
const selectedProjectIds = getSelectedProjectIds();
const projects = getSelectedProjects(config.projects ?? [], selectedProjectIds);

registerTokensStudioTransforms(StyleDictionary);

if (selectedProjectIds && projects.length === 0) {
  console.log("No token projects selected for artifact build.");
}

for (const project of projects) {
  const tokenPath = path.join(rootDir, project.tokenFile);
  if (!fs.existsSync(tokenPath)) {
    console.log(
      `Skipping build for ${project.id}: ${project.tokenFile} does not exist yet. It will be created by the first plugin PR/MR.`,
    );
    continue;
  }
  const tokens = readJson(tokenPath);
  validateTokenDocument(tokens, project.tokenFile);
  const themes = getThemesFromTokenDocument(project, tokens);
  const colorSchemeRootSegments = getColorSchemeRootSegments(themes);
  const outputDir = path.join(rootDir, project.outputDir);
  resetOutputDir(rootDir, outputDir, project);
  const buildTime = new Date().toISOString();
  const manifest = {
    project: project.id,
    version: buildTime.replace(/[-:]/g, "").replace(/\..+$/, "Z"),
    buildTime,
    sourceCommit: getSourceCommit(rootDir),
    css: `css/${project.id}.tokens.css`,
    themes: {},
    html: {},
  };
  const colorSchemeCssBlocks = [];
  const colorSchemeVariableNames = new Map();

  for (const theme of themes) {
    const artifactBase = `${project.id}.${theme.outputId}`;
    const cssFile = `css/${artifactBase}.tokens.css`;
    const resolvedTokensFile = `json/${artifactBase}.resolved-tokens.json`;
    const metadataFile = `json/${artifactBase}.metadata.json`;
    const colorSchemeOutput = await buildThemeWithStyleDictionary({
      tokens: selectThemeTokens(tokens, theme.sets),
      outputDir,
      cssFile,
      resolvedTokensFile,
      metadataFile,
      themeId: theme.outputId,
      colorSchemeRootSegments,
    });
    manifest.themes[theme.outputId] = {
      css: cssFile,
      resolvedTokens: resolvedTokensFile,
      metadata: metadataFile,
    };
    colorSchemeCssBlocks.push(colorSchemeOutput.cssBlock);
    colorSchemeVariableNames.set(
      theme.outputId,
      colorSchemeOutput.variableNames,
    );
  }

  assertColorSchemesExposeSameVariables(colorSchemeVariableNames);
  writeColorSchemeCss(outputDir, manifest.css, colorSchemeCssBlocks);
  writeHtmlDemo(outputDir, manifest.css, themes, manifest.html);

  for (const poolName of project.blockPools ?? []) {
    const poolDir = path.join(rootDir, "blocks", "pools", poolName);
    if (!fs.existsSync(poolDir)) continue;
    for (const blockName of fs.readdirSync(poolDir)) {
      const blockDir = path.join(poolDir, blockName);
      const contractPath = path.join(blockDir, "block.json");
      const examplesPath = path.join(blockDir, "examples.json");
      if (!fs.existsSync(contractPath) || !fs.existsSync(examplesPath))
        continue;
      const contract = readJson(contractPath);
      const template = fs.readFileSync(
        path.join(blockDir, contract.template),
        "utf8",
      );
      const example = readJson(examplesPath).examples?.[0];
      if (!example) continue;
      const slotOutput = {};
      for (const [slotName, children] of Object.entries(example.slots ?? {})) {
        slotOutput[slotName] = children
          .map((child) => renderChildBlock(rootDir, poolDir, child))
          .join("\n");
      }
      const html = renderTemplate(template, example.props ?? {}, slotOutput);
      const htmlFile = `html/${contract.id}.html`;
      writeFile(path.join(outputDir, htmlFile), `${html.trim()}\n`);
      manifest.html[contract.id] = htmlFile;
    }
  }

  writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Built ${project.id} into ${project.outputDir}`);
}

function getSelectedProjectIds() {
  const values = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--project=")) {
      values.push(arg.slice("--project=".length));
    }
    if (arg.startsWith("--projects=")) {
      values.push(...arg.slice("--projects=".length).split(","));
    }
  }

  if ("TOKEN_PROJECTS" in process.env) {
    values.push(...process.env.TOKEN_PROJECTS.split(","));
  }

  const selected = values.map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? new Set(selected) : null;
}

function getSelectedProjects(projects, selectedProjectIds) {
  if (!selectedProjectIds) return projects;

  const knownProjectIds = new Set(projects.map((project) => project.id));
  for (const projectId of selectedProjectIds) {
    if (!knownProjectIds.has(projectId)) {
      throw new Error(`Unknown token project selected for build: ${projectId}`);
    }
  }

  return projects.filter((project) => selectedProjectIds.has(project.id));
}

function renderChildBlock(rootDir, poolDir, child) {
  const blockDir = path.join(poolDir, child.type);
  const contract = readJson(path.join(blockDir, "block.json"));
  const template = fs.readFileSync(
    path.join(blockDir, contract.template),
    "utf8",
  );
  return renderTemplate(template, child.props ?? {});
}

function selectThemeTokens(tokens, selectedSets = []) {
  return Object.fromEntries(
    selectedSets
      .filter((setName) => tokens[setName])
      .map((setName) => [setName, tokens[setName]]),
  );
}

function getColorSchemeRootSegments(themes) {
  const themeCount = themes.length;
  const countBySet = new Map();

  for (const theme of themes) {
    for (const setName of new Set(theme.sets.map((set) => kebabSegment(set)))) {
      countBySet.set(setName, (countBySet.get(setName) ?? 0) + 1);
    }
  }

  return new Set(
    [...countBySet.entries()]
      .filter(([, count]) => count < themeCount)
      .map(([setName]) => setName),
  );
}

function getThemesFromTokenDocument(project, tokens) {
  if (!Array.isArray(tokens.$themes) || tokens.$themes.length === 0) {
    throw new Error(
      `${project.tokenFile} must include a non-empty $themes array.`,
    );
  }

  const outputIds = new Set();

  return tokens.$themes.map((theme) => {
    if (!theme || typeof theme !== "object") {
      throw new Error(`${project.tokenFile} has an invalid theme entry.`);
    }
    if (!theme.id || typeof theme.id !== "string") {
      throw new Error(`${project.tokenFile} has a theme without a string id.`);
    }

    const sets = Object.entries(theme.selectedTokenSets ?? {})
      .filter(([, state]) => state !== "disabled")
      .map(([setName]) => setName);

    if (sets.length === 0) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} has no enabled token sets.`,
      );
    }

    const outputName =
      typeof theme.name === "string" && theme.name.trim()
        ? theme.name
        : theme.id;
    const outputId =
      themeOutputSegment(project.id, outputName) ||
      themeOutputSegment(project.id, theme.id);
    if (!outputId) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} does not produce a valid kebab-case theme output name.`,
      );
    }
    if (outputIds.has(outputId)) {
      throw new Error(
        `${project.tokenFile} has multiple themes that produce generated theme id ${outputId}.`,
      );
    }
    outputIds.add(outputId);

    return {
      id: theme.id,
      name: theme.name ?? theme.id,
      sets,
      outputId,
    };
  });
}

function themeOutputSegment(projectId, themeId) {
  const projectSegment = kebabSegment(projectId);
  const themeSegment = kebabSegment(themeId);

  return themeSegment.startsWith(`${projectSegment}-`)
    ? themeSegment.slice(projectSegment.length + 1)
    : themeSegment;
}

function kebabSegment(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function resetOutputDir(rootDir, outputDir, project) {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedOutputDir = path.resolve(outputDir);

  if (
    resolvedOutputDir === resolvedRootDir ||
    !resolvedOutputDir.startsWith(`${resolvedRootDir}${path.sep}`)
  ) {
    throw new Error(
      `${project.id} outputDir must resolve inside the repository root.`,
    );
  }

  fs.rmSync(resolvedOutputDir, { recursive: true, force: true });
}

function writeColorSchemeCss(outputDir, cssFile, colorSchemeCssBlocks) {
  writeFile(
    path.join(outputDir, cssFile),
    `${GENERATED_FILE_HEADER}\n\n${colorSchemeCssBlocks.join("\n\n")}\n`,
  );
}

function writeHtmlDemo(outputDir, cssFile, themes, htmlManifest) {
  const [defaultTheme, scopedTheme] = themes;
  const scopedExample = scopedTheme
    ? [
        "",
        `    <section class="demo" data-color-scheme="${scopedTheme.outputId}">`,
        `      <h2>Scoped ${escapeHtmlText(scopedTheme.name)} Section</h2>`,
        "      <button>Scoped Button</button>",
        "    </section>",
      ].join("\n")
    : "";
  const htmlFile = "html/demo.html";
  const html = [
    "<!-- Do not edit directly, this file was auto-generated. -->",
    "",
    "<!doctype html>",
    `<html data-color-scheme="${defaultTheme.outputId}">`,
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>Design Token Demo</title>",
    `    <link rel="stylesheet" href="../${cssFile}" />`,
    "  </head>",
    "  <body>",
    '    <section class="demo">',
    "      <h1>Design Token Demo</h1>",
    "      <button>Example Button</button>",
    `    </section>${scopedExample}`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");

  writeFile(path.join(outputDir, htmlFile), html);
  htmlManifest.demo = htmlFile;
}

async function buildThemeWithStyleDictionary({
  tokens,
  outputDir,
  cssFile,
  resolvedTokensFile,
  metadataFile,
  themeId,
  colorSchemeRootSegments,
}) {
  const dictionary = new StyleDictionary({
    tokens,
    preprocessors: ["tokens-studio"],
    hooks: {
      formats: {
        "ekn/css-variables": ({ dictionary, options }) =>
          `${GENERATED_FILE_HEADER}\n\n${formatCssVariablesBlock({
            dictionary,
            selector: ":root",
            outputReferences: options.outputReferences,
            themeId: options.themeId,
            colorSchemeRootSegments: options.colorSchemeRootSegments,
          })}\n`,
        "ekn/resolved-tokens-json": ({ dictionary }) => {
          const resolvedTokens = Object.fromEntries(
            dictionary.allTokens
              .map((token) => [
                token.path.join("."),
                compactObject({
                  type: tokenType(token),
                  value: tokenValue(token),
                  description: tokenDescription(token),
                }),
              ])
              .sort(([left], [right]) => left.localeCompare(right)),
          );
          return `${JSON.stringify(resolvedTokens, null, 2)}\n`;
        },
        "ekn/metadata-json": ({ dictionary }) => {
          const metadata = Object.fromEntries(
            dictionary.allTokens
              .map((token) => [
                token.path.join("."),
                {
                  value: tokenValue(token),
                  originalValue: tokenOriginalValue(token),
                  cssVariable: `--${semanticCssTokenName(token, themeId, colorSchemeRootSegments)}`,
                  theme: themeId,
                },
              ])
              .sort(([left], [right]) => left.localeCompare(right)),
          );
          return `${JSON.stringify(metadata, null, 2)}\n`;
        },
      },
    },
    platforms: {
      css: {
        transformGroup: "tokens-studio",
        transforms: ["name/kebab"],
        buildPath: `${path.join(outputDir, path.dirname(cssFile))}/`,
        files: [
          {
            destination: path.basename(cssFile),
            format: "ekn/css-variables",
            options: {
              outputReferences: true,
              themeId,
              colorSchemeRootSegments,
            },
          },
        ],
      },
      metadata: {
        transformGroup: "tokens-studio",
        transforms: ["name/kebab"],
        buildPath: `${path.join(outputDir, path.dirname(metadataFile))}/`,
        files: [
          {
            destination: path.basename(resolvedTokensFile),
            format: "ekn/resolved-tokens-json",
            options: {
              showFileHeader: false,
            },
          },
          {
            destination: path.basename(metadataFile),
            format: "ekn/metadata-json",
            options: {
              showFileHeader: false,
            },
          },
        ],
      },
    },
  });

  await dictionary.buildAllPlatforms();
  const cssDictionary = await dictionary.getPlatformTokens("css");
  const cssBlock = formatCssVariablesBlock({
    dictionary: cssDictionary,
    selector: colorSchemeSelector(themeId),
    outputReferences: true,
    themeId,
    colorSchemeRootSegments,
  });

  return {
    cssBlock,
    variableNames: getCssVariableNames(cssDictionary),
  };
}

function formatCssVariablesBlock({
  dictionary,
  selector,
  outputReferences,
  themeId,
  colorSchemeRootSegments,
}) {
  normalizeCssDictionaryNames(dictionary, themeId, colorSchemeRootSegments);
  const variables = formattedVariables({
    format: propertyFormatNames.css,
    dictionary,
    outputReferences,
    formatting: {
      indentation: "  ",
    },
  });

  return `${selector} {\n${variables}\n}`;
}

function normalizeCssDictionaryNames(
  dictionary,
  themeId,
  colorSchemeRootSegments,
) {
  const normalizedTokens = new Set();
  for (const token of dictionary.allTokens ?? []) {
    normalizeCssTokenName(
      token,
      themeId,
      colorSchemeRootSegments,
      normalizedTokens,
    );
  }
  assertUniqueCssTokenNames(dictionary.allTokens ?? [], themeId);
  normalizeCssTokenTree(
    dictionary.tokens,
    themeId,
    colorSchemeRootSegments,
    normalizedTokens,
  );
}

function assertUniqueCssTokenNames(tokens, themeId) {
  const tokenPathByName = new Map();
  for (const token of tokens) {
    const tokenPath = Array.isArray(token.path)
      ? token.path.join(".")
      : token.name;
    const existingPath = tokenPathByName.get(token.name);
    if (existingPath && existingPath !== tokenPath) {
      throw new Error(
        `Theme ${themeId} produces duplicate CSS variable --${token.name} from ${existingPath} and ${tokenPath}.`,
      );
    }
    tokenPathByName.set(token.name, tokenPath);
  }
}

function normalizeCssTokenTree(
  node,
  themeId,
  colorSchemeRootSegments,
  normalizedTokens,
) {
  if (!node || typeof node !== "object") return;
  normalizeCssTokenName(
    node,
    themeId,
    colorSchemeRootSegments,
    normalizedTokens,
  );
  for (const child of Object.values(node)) {
    normalizeCssTokenTree(
      child,
      themeId,
      colorSchemeRootSegments,
      normalizedTokens,
    );
  }
}

function normalizeCssTokenName(
  token,
  themeId,
  colorSchemeRootSegments,
  normalizedTokens,
) {
  if (
    !token ||
    typeof token !== "object" ||
    normalizedTokens.has(token) ||
    typeof token.name !== "string"
  ) {
    return;
  }
  normalizedTokens.add(token);
  token.name = semanticCssTokenName(token, themeId, colorSchemeRootSegments);
}

function semanticCssTokenName(token, themeId, colorSchemeRootSegments) {
  if (!Array.isArray(token.path) || token.path.length < 2) {
    return token.name;
  }

  const rootSegment = kebabSegment(token.path[0]);
  const isColorSchemeRoot =
    rootSegment === themeId || colorSchemeRootSegments?.has(rootSegment);
  if (!isColorSchemeRoot) {
    return token.name;
  }

  return (
    token.path
      .slice(1)
      .map((segment) => kebabSegment(segment))
      .filter(Boolean)
      .join("-") || token.name
  );
}

function getCssVariableNames(dictionary) {
  return (dictionary.allTokens ?? [])
    .map((token) => token.name)
    .filter((name) => typeof name === "string" && name.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function assertColorSchemesExposeSameVariables(variableNamesByScheme) {
  const entries = [...variableNamesByScheme.entries()];
  const [firstScheme, firstNames] = entries[0] ?? [];
  if (!firstScheme || !firstNames) return;

  const firstSet = new Set(firstNames);
  for (const [scheme, names] of entries.slice(1)) {
    const currentSet = new Set(names);
    const missing = firstNames.filter((name) => !currentSet.has(name));
    const extra = names.filter((name) => !firstSet.has(name));

    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        [
          `Color scheme ${scheme} does not expose the same CSS variables as ${firstScheme}.`,
          missing.length ? `Missing: ${missing.join(", ")}` : "",
          extra.length ? `Extra: ${extra.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }
}

function colorSchemeSelector(schemeId) {
  const quotedSchemeId = JSON.stringify(schemeId);
  return [
    `:root[data-color-scheme=${quotedSchemeId}]`,
    `[data-color-scheme=${quotedSchemeId}]`,
  ].join(",\n");
}

function getSourceCommit(cwd) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function tokenValue(token) {
  return token.value ?? token.$value;
}

function tokenOriginalValue(token) {
  return token.original?.value ?? token.original?.$value ?? tokenValue(token);
}

function tokenType(token) {
  return token.type ?? token.$type;
}

function tokenDescription(token) {
  return token.description ?? token.$description;
}

function escapeHtmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
