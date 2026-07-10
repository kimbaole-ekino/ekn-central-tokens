import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { BuildTheme, TokenProject } from "./types.js";
import { writeFile } from "./token-utils.js";
import { GENERATED_FILE_HEADER } from "./style-dictionary.js";

export function resetOutputDir(
  rootDir: string,
  outputDir: string,
  project: TokenProject,
): void {
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

export function writeCssBlocks(
  outputDir: string,
  cssFile: string,
  cssBlocks: string[],
): void {
  writeFile(
    path.join(outputDir, cssFile),
    `${GENERATED_FILE_HEADER}\n\n${cssBlocks.join("\n\n")}\n`,
  );
}

export interface ThemeArtifactPaths {
  css: string;
  resolvedTokens: string;
  metadata: string;
  manifestKey: string;
}

export function getThemeArtifactPaths(
  project: TokenProject,
  theme: BuildTheme,
): ThemeArtifactPaths {
  if (project.themeFolders) {
    return {
      css: `css/${theme.groupId}/${theme.outputId}.css`,
      resolvedTokens: `json/${theme.groupId}/${theme.outputId}.resolved-tokens.json`,
      metadata: `json/${theme.groupId}/${theme.outputId}.metadata.json`,
      manifestKey: `${theme.groupId}/${theme.outputId}`,
    };
  }

  const artifactBase = `${project.id}.${theme.outputId}`;
  return {
    css: `css/${artifactBase}.tokens.css`,
    resolvedTokens: `json/${artifactBase}.resolved-tokens.json`,
    metadata: `json/${artifactBase}.metadata.json`,
    manifestKey: theme.outputId,
  };
}

export function getThemeGroupCssPaths(
  project: TokenProject,
  groupId: string,
): { css: string; referenceCss: string } {
  return project.themeFolders
    ? {
        css: `css/${groupId}/token.css`,
        referenceCss: `css/${groupId}/reference.css`,
      }
    : {
        css: `css/${project.id}.tokens.css`,
        referenceCss: `css/${project.id}.reference.css`,
      };
}

export function getSourceCommit(cwd: string): string {
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
