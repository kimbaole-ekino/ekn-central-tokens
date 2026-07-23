import fs from "node:fs";
import path from "node:path";
import { getChangelogSection, parseProjectReleaseTag } from "./lib/release.js";
import { getSelectedProjects } from "./lib/project-selection.js";
import { getProjectsConfig, writeFile } from "./lib/token-utils.js";
import { validateProjectsConfig } from "./validate-token-projects.js";

export interface ProjectReleaseInfo {
  projectId: string;
  version: string;
  tag: string;
  changelogPath: string;
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  try {
    const root = process.cwd();
    const tag = requiredArg("--tag");
    const outputDir = path.join(root, "release-metadata");
    const info = getProjectReleaseInfo(root, tag);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    const notes = getChangelogSection(
      fs.readFileSync(path.join(root, info.changelogPath), "utf8"),
      info.version,
    );
    writeFile(
      path.join(outputDir, "release-info.json"),
      `${JSON.stringify(info, null, 2)}\n`,
    );
    writeFile(path.join(outputDir, "release-notes.md"), notes);
    console.log(JSON.stringify(info));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export function getProjectReleaseInfo(
  root: string,
  tag: string,
): ProjectReleaseInfo {
  const parsed = parseProjectReleaseTag(tag);
  const config = getProjectsConfig(root);
  validateProjectsConfig(config, root);
  const [project] = getSelectedProjects(
    config.projects ?? [],
    new Set([parsed.projectId]),
  );
  if (!project) {
    throw new Error(`Unknown project ID: ${parsed.projectId}.`);
  }
  if (project.version !== parsed.version) {
    throw new Error(
      `${project.id} tag version ${parsed.version} does not match configured version ${project.version}.`,
    );
  }
  return {
    projectId: project.id,
    version: project.version,
    tag,
    changelogPath: path.posix.join(
      path.posix.dirname(project.tokenFile),
      "CHANGELOG.md",
    ),
  };
}

function requiredArg(name: string): string {
  const prefix = `${name}=`;
  const value = process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
