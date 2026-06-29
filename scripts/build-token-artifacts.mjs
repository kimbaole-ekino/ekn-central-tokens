import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import StyleDictionary from "style-dictionary";
import { register as registerTokensStudioTransforms } from "@tokens-studio/sd-transforms";
import {
  getProjectsConfig,
  readJson,
  renderTemplate,
  validateTokenDocument,
  writeFile,
} from "./token-build-utils.mjs";

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
  const outputDir = path.join(rootDir, project.outputDir);
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
  const themeCssFiles = [];

  for (const theme of themes) {
    const artifactBase = `${project.id}.${theme.outputId}`;
    const cssFile = `css/${artifactBase}.tokens.css`;
    const resolvedTokensFile = `json/${artifactBase}.resolved-tokens.json`;
    const metadataFile = `json/${artifactBase}.metadata.json`;
    await buildThemeWithStyleDictionary({
      tokens: selectThemeTokens(tokens, theme.sets),
      outputDir,
      cssFile,
      resolvedTokensFile,
      metadataFile,
      themeId: theme.outputId,
    });
    manifest.themes[theme.outputId] = {
      css: cssFile,
      resolvedTokens: resolvedTokensFile,
      metadata: metadataFile,
    };
    themeCssFiles.push(cssFile);
  }

  writeCssIndex(outputDir, manifest.css, themeCssFiles);

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

function writeCssIndex(outputDir, cssIndexFile, themeCssFiles) {
  const imports = themeCssFiles
    .map((cssFile) => `@import './${path.posix.basename(cssFile)}';`)
    .join("\n");
  writeFile(path.join(outputDir, cssIndexFile), `${imports}\n`);
}

async function buildThemeWithStyleDictionary({
  tokens,
  outputDir,
  cssFile,
  resolvedTokensFile,
  metadataFile,
  themeId,
}) {
  const dictionary = new StyleDictionary({
    tokens,
    preprocessors: ["tokens-studio"],
    hooks: {
      formats: {
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
                  cssVariable: `--${token.name}`,
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
            format: "css/variables",
            options: {
              outputReferences: true,
              selector: `[data-theme="${themeId}"]`,
              showFileHeader: false,
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
