import fs from "node:fs";
import path from "node:path";
import {
  getSelectedProjectIds,
  getSelectedProjects,
} from "./lib/project-selection.js";
import {
  getColorSchemeRootSegments,
  getReferenceRootSegments,
  getThemesFromTokenDocument,
  selectThemeTokens,
} from "./lib/themes.js";
import {
  getProjectsConfig,
  readJson,
  validateTokenDocument,
  writeFile,
} from "./lib/token-utils.js";
import type { BuildManifest, TokenDocument } from "./lib/types.js";
import {
  assertColorSchemesExposeSameVariables,
  buildThemeWithStyleDictionary,
  registerStyleDictionaryTransforms,
} from "./lib/style-dictionary.js";
import {
  getSourceCommit,
  resetOutputDir,
  writeCssBlocks,
} from "./lib/artifact-output.js";
import { writeBlockExamples, writeHtmlDemo } from "./lib/html-artifacts.js";

const rootDir = process.cwd();
const config = getProjectsConfig(rootDir);
const selectedProjectIds = getSelectedProjectIds();
const projects = getSelectedProjects(config.projects ?? [], selectedProjectIds);

registerStyleDictionaryTransforms();

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

  const tokens = readJson<TokenDocument>(tokenPath);
  validateTokenDocument(tokens, project.tokenFile);

  const themes = getThemesFromTokenDocument(project, tokens);
  const colorSchemeRootSegments = getColorSchemeRootSegments(themes);
  const referenceRootSegments = getReferenceRootSegments(
    themes,
    colorSchemeRootSegments,
  );
  const splitReferenceCss =
    colorSchemeRootSegments.size > 0 && referenceRootSegments.size > 0;
  const outputDir = path.join(rootDir, project.outputDir);
  resetOutputDir(rootDir, outputDir, project);

  const buildTime = new Date().toISOString();
  const aggregateCssFile = `css/${project.id}.tokens.css`;
  const referenceCssFile = `css/${project.id}.reference.css`;
  const manifest: BuildManifest = {
    project: project.id,
    version: buildTime.replace(/[-:]/g, "").replace(/\..+$/, "Z"),
    buildTime,
    sourceCommit: getSourceCommit(rootDir),
    css: aggregateCssFile,
    themes: {},
    html: {},
  };
  if (splitReferenceCss) {
    manifest.referenceCss = referenceCssFile;
  }

  const colorSchemeCssBlocks: string[] = [];
  const colorSchemeVariableNames = new Map<string, string[]>();
  let referenceCssBlock: string | null = null;

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
      splitReferenceCss,
    });

    manifest.themes[theme.outputId] = {
      css: cssFile,
      resolvedTokens: resolvedTokensFile,
      metadata: metadataFile,
    };
    if (splitReferenceCss && referenceCssBlock === null) {
      referenceCssBlock = colorSchemeOutput.referenceCssBlock;
    }
    colorSchemeCssBlocks.push(colorSchemeOutput.cssBlock);
    colorSchemeVariableNames.set(
      theme.outputId,
      colorSchemeOutput.variableNames,
    );
  }

  assertColorSchemesExposeSameVariables(colorSchemeVariableNames);
  if (splitReferenceCss && referenceCssBlock) {
    writeCssBlocks(outputDir, referenceCssFile, [referenceCssBlock]);
  }
  writeCssBlocks(outputDir, manifest.css, colorSchemeCssBlocks);
  writeHtmlDemo(
    outputDir,
    manifest.css,
    manifest.referenceCss,
    themes,
    manifest.html,
  );
  writeBlockExamples(rootDir, outputDir, project, manifest.html);

  writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Built ${project.id} into ${project.outputDir}`);
}
