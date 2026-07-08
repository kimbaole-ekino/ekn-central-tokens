import fs from "node:fs";
import path from "node:path";
import {
  getProjectsConfig,
  getTargetsConfig,
  readJson,
  validateTokenDocument,
} from "./lib/token-utils.js";
import type {
  ProjectsConfig,
  TargetConfig,
  TokenDocument,
  TokenProject,
} from "./lib/types.js";

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function main(): void {
  const rootDir = process.cwd();
  const config = getProjectsConfig(rootDir);
  const targetsConfig = getTargetsConfig(rootDir);
  const projectIds = new Set<string>();
  let validatedTokenFiles = 0;
  let pendingTokenFiles = 0;

  validateProjectsConfig(config, projectIds);
  validateTargetsConfig(targetsConfig, config, projectIds);

  for (const project of config.projects ?? []) {
    const tokenPath = path.join(rootDir, project.tokenFile);
    if (!fs.existsSync(tokenPath)) {
      pendingTokenFiles += 1;
      console.log(
        `Skipping ${project.id}: ${project.tokenFile} does not exist yet. It will be created by the first plugin PR/MR.`,
      );
      continue;
    }
    const tokens = readJson<TokenDocument>(tokenPath);
    validateTokenDocument(tokens, project.tokenFile);
    validatedTokenFiles += 1;
  }

  console.log(
    `Validated ${validatedTokenFiles} token file(s); ${pendingTokenFiles} pending first sync project(s).`,
  );
}

function validateProjectsConfig(
  projectsConfig: ProjectsConfig,
  projectIds: Set<string>,
): void {
  if (!Array.isArray(projectsConfig.projects)) {
    throw new Error('projects.config.json: "projects" must be an array.');
  }

  for (const [index, project] of projectsConfig.projects.entries()) {
    const pathPrefix = `projects.config.json.projects[${index}]`;
    requireString(project.id, `${pathPrefix}.id`);
    requireString(project.tokenFile, `${pathPrefix}.tokenFile`);
    requireString(project.outputDir, `${pathPrefix}.outputDir`);

    if (projectIds.has(project.id)) {
      throw new Error(`${pathPrefix}.id duplicates project ${project.id}.`);
    }
    projectIds.add(project.id);

    if (!project.tokenFile.endsWith("/tokens.json")) {
      throw new Error(
        `${pathPrefix}.tokenFile must point to a tokens.json file.`,
      );
    }
    if (path.isAbsolute(project.tokenFile) || project.tokenFile.includes("..")) {
      throw new Error(`${pathPrefix}.tokenFile must be repository-relative.`);
    }
    if (path.isAbsolute(project.outputDir) || project.outputDir.includes("..")) {
      throw new Error(`${pathPrefix}.outputDir must be repository-relative.`);
    }
    if (
      project.blockPools !== undefined &&
      (!Array.isArray(project.blockPools) ||
        !project.blockPools.every((pool) => typeof pool === "string"))
    ) {
      throw new Error(`${pathPrefix}.blockPools must be an array of strings.`);
    }
  }
}

function validateTargetsConfig(
  targetsConfig: { targets?: TargetConfig[] },
  projectsConfig: ProjectsConfig,
  projectIds: Set<string>,
): void {
  if (!Array.isArray(targetsConfig.targets)) {
    throw new Error('targets.config.json: "targets" must be an array.');
  }

  const outputByProject = new Map(
    (projectsConfig.projects ?? []).map((project) => [
      project.id,
      project.outputDir,
    ]),
  );

  for (const [index, target] of targetsConfig.targets.entries()) {
    const pathPrefix = `targets.config.json.targets[${index}]`;
    requireString(target.project, `${pathPrefix}.project`);
    requireString(target.repo, `${pathPrefix}.repo`);
    requireString(target.branch, `${pathPrefix}.branch`);
    requireString(target.source, `${pathPrefix}.source`);
    requireString(target.destination?.css, `${pathPrefix}.destination.css`);

    if (!projectIds.has(target.project)) {
      throw new Error(
        `${pathPrefix}.project references unknown project ${target.project}.`,
      );
    }

    const expectedSource = outputByProject.get(target.project);
    if (target.source !== expectedSource) {
      throw new Error(
        `${pathPrefix}.source must match ${target.project} outputDir (${expectedSource}).`,
      );
    }

    for (const [field, value] of Object.entries(target.destination ?? {})) {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${pathPrefix}.destination.${field} must be a string.`);
      }
      if (path.isAbsolute(value) || value.includes("..")) {
        throw new Error(
          `${pathPrefix}.destination.${field} must be target-repository-relative.`,
        );
      }
    }
  }
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}
