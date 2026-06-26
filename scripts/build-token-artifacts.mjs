import fs from "node:fs";
import path from "node:path";
import StyleDictionary from "style-dictionary";
import {
  getProjectsConfig,
  readJson,
  renderTemplate,
  validateTokenDocument,
  writeFile,
} from "./token-build-utils.mjs";

const rootDir = process.cwd();
const config = getProjectsConfig(rootDir);

for (const project of config.projects ?? []) {
  const tokenPath = path.join(rootDir, project.tokenFile);
  const tokens = readJson(tokenPath);
  validateTokenDocument(tokens, project.tokenFile);
  const themes = getThemesFromTokenDocument(project, tokens);
  const outputDir = path.join(rootDir, project.outputDir);
  const manifest = {
    project: project.id,
    version: new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+$/, "Z"),
    themes: {},
    html: {},
  };

  for (const theme of themes) {
    const cssFile = `css/${theme.output}`;
    const metadataFile = `json/${theme.id}.metadata.json`;
    await buildThemeWithStyleDictionary({
      tokens: selectThemeTokens(tokens, theme.sets),
      outputDir,
      cssFile,
      metadataFile,
      themeId: theme.id,
    });
    manifest.themes[theme.id] = { css: cssFile, metadata: metadataFile };
  }

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

    return {
      id: theme.id,
      name: theme.name ?? theme.id,
      sets,
      output: `${project.id}.${themeOutputSegment(project.id, theme.id)}.css`,
    };
  });
}

function themeOutputSegment(projectId, themeId) {
  const segment = themeId.startsWith(`${projectId}-`)
    ? themeId.slice(projectId.length + 1)
    : themeId;

  return segment
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function buildThemeWithStyleDictionary({
  tokens,
  outputDir,
  cssFile,
  metadataFile,
  themeId,
}) {
  const dictionary = new StyleDictionary({
    tokens,
    hooks: {
      formats: {
        "ekn/metadata-json": ({ dictionary }) => {
          const metadata = Object.fromEntries(
            dictionary.allTokens
              .map((token) => [
                token.path.join("."),
                {
                  value: token.value,
                  originalValue: token.original?.value ?? token.value,
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
        transformGroup: "css",
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
        transformGroup: "css",
        buildPath: `${path.join(outputDir, path.dirname(metadataFile))}/`,
        files: [
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
