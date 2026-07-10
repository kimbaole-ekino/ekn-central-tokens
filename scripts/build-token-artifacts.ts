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
  groupThemesByParent,
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
  buildThemeWithStyleDictionary,
  type CssVariableDeclaration,
  registerStyleDictionaryTransforms,
} from "./lib/style-dictionary.js";
import {
  getSourceCommit,
  getThemeArtifactPaths,
  getThemeGroupCssPaths,
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
  const themeGroups = project.themeFolders
    ? groupThemesByParent(themes)
    : [{ id: "", name: project.id, themes }];
  const outputDir = path.join(rootDir, project.outputDir);
  resetOutputDir(rootDir, outputDir, project);

  const buildTime = new Date().toISOString();
  const sourceCommit = getSourceCommit(rootDir);
  const manifest: BuildManifest = {
    project: project.id,
    version: getArtifactVersion(sourceCommit),
    buildTime,
    sourceCommit,
    themes: {},
    html: {},
  };
  if (project.themeFolders) {
    manifest.themeGroups = {};
  }

  const builtThemeGroups: Array<{
    css: string;
    referenceCss?: string;
    themes: typeof themes;
  }> = [];

  for (const themeGroup of themeGroups) {
    const colorSchemeRootSegments = getColorSchemeRootSegments(
      themeGroup.themes,
    );
    const referenceRootSegments = getReferenceRootSegments(
      themeGroup.themes,
      colorSchemeRootSegments,
    );
    const splitReferenceCss =
      colorSchemeRootSegments.size > 0 && referenceRootSegments.size > 0;
    const groupPaths = getThemeGroupCssPaths(project, themeGroup.id);
    const colorSchemeCssBlocks: string[] = [];
    const referenceCssDeclarations: CssVariableDeclaration[] = [];

    if (project.themeFolders) {
      manifest.themeGroups![themeGroup.id] = {
        css: groupPaths.css,
        themes: [],
      };
      if (splitReferenceCss) {
        manifest.themeGroups![themeGroup.id]!.referenceCss =
          groupPaths.referenceCss;
      }
    } else {
      manifest.css = groupPaths.css;
      if (splitReferenceCss) manifest.referenceCss = groupPaths.referenceCss;
    }

    for (const theme of themeGroup.themes) {
      const paths = getThemeArtifactPaths(project, theme);
      const colorSchemeOutput = await buildThemeWithStyleDictionary({
        tokens: selectThemeTokens(tokens, theme.sets),
        outputDir,
        cssFile: paths.css,
        resolvedTokensFile: paths.resolvedTokens,
        metadataFile: paths.metadata,
        themeId: theme.outputId,
        colorSchemeRootSegments,
        splitReferenceCss,
      });

      manifest.themes[paths.manifestKey] = {
        css: paths.css,
        resolvedTokens: paths.resolvedTokens,
        metadata: paths.metadata,
        ...(project.themeFolders ? { group: theme.groupId } : {}),
      };
      if (project.themeFolders) {
        manifest.themeGroups![themeGroup.id]!.themes.push(paths.manifestKey);
      }
      if (splitReferenceCss) {
        referenceCssDeclarations.push(
          ...colorSchemeOutput.referenceCssDeclarations,
        );
      }
      colorSchemeCssBlocks.push(colorSchemeOutput.cssBlock);
    }

    const referenceCssBlock = mergeReferenceCssDeclarations(
      referenceCssDeclarations,
    );
    if (splitReferenceCss) {
      if (!referenceCssBlock) {
        throw new Error(
          `Theme group ${themeGroup.name} did not produce reference CSS declarations.`,
        );
      }
      writeCssBlocks(outputDir, groupPaths.referenceCss, [referenceCssBlock]);
    }
    writeCssBlocks(outputDir, groupPaths.css, colorSchemeCssBlocks);
    builtThemeGroups.push({
      css: groupPaths.css,
      referenceCss: splitReferenceCss ? groupPaths.referenceCss : undefined,
      themes: themeGroup.themes,
    });
  }

  const demoThemeGroup = builtThemeGroups[0];
  if (demoThemeGroup) {
    writeHtmlDemo(
      outputDir,
      demoThemeGroup.css,
      demoThemeGroup.referenceCss,
      demoThemeGroup.themes,
      manifest.html,
    );
  }
  writeBlockExamples(rootDir, outputDir, project, manifest.html);

  writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Built ${project.id} into ${project.outputDir}`);
}

function mergeReferenceCssDeclarations(
  declarations: CssVariableDeclaration[],
): string | null {
  const declarationsByVariable = new Map<string, CssVariableDeclaration>();

  for (const declaration of declarations) {
    const existingDeclaration = declarationsByVariable.get(
      declaration.variableName,
    );
    if (
      existingDeclaration &&
      existingDeclaration.declaration !== declaration.declaration
    ) {
      throw new Error(
        `Reference CSS variable ${declaration.variableName} has conflicting values: ${existingDeclaration.declaration} and ${declaration.declaration}`,
      );
    }
    declarationsByVariable.set(declaration.variableName, declaration);
  }

  if (declarationsByVariable.size === 0) return null;

  const orderedDeclarations = orderReferenceCssDeclarations([
    ...declarationsByVariable.values(),
  ]);

  return `:root {\n${orderedDeclarations
    .map(({ declaration }) => `  ${declaration}`)
    .join("\n")}\n}`;
}

function orderReferenceCssDeclarations(
  declarations: CssVariableDeclaration[],
): CssVariableDeclaration[] {
  const declarationsByVariable = new Map(
    declarations.map((declaration) => [declaration.variableName, declaration]),
  );
  const orderedDeclarations: CssVariableDeclaration[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(declaration: CssVariableDeclaration, stack: string[]): void {
    if (visited.has(declaration.variableName)) return;
    if (visiting.has(declaration.variableName)) {
      throw new Error(
        `Reference CSS variables contain a cycle: ${[
          ...stack,
          declaration.variableName,
        ].join(" -> ")}`,
      );
    }

    visiting.add(declaration.variableName);

    for (const dependency of declaration.dependencies) {
      const dependencyDeclaration = declarationsByVariable.get(dependency);
      if (!dependencyDeclaration) {
        throw new Error(
          `Reference CSS variable ${declaration.variableName} depends on missing ${dependency}`,
        );
      }
      visit(dependencyDeclaration, [...stack, declaration.variableName]);
    }

    visiting.delete(declaration.variableName);
    visited.add(declaration.variableName);
    orderedDeclarations.push(declaration);
  }

  for (const declaration of declarations) {
    visit(declaration, []);
  }

  return orderedDeclarations;
}

function getArtifactVersion(sourceCommit: string): string {
  return sourceCommit === "unknown" ? "unknown" : sourceCommit.slice(0, 12);
}
