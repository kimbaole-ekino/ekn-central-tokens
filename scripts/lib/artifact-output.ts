import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TokenProject } from "./types.js";
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
