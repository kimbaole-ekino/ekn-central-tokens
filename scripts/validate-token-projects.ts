import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  getProjectsConfig,
  getTargetsConfig,
  readTokenDocument,
  validateTokenDocument,
} from "./lib/token-utils.js";
import { getSelectedProjectIds } from "./lib/project-selection.js";
import { discoverTokenProjects } from "./lib/project-discovery.js";
import type {
  ProjectsConfig,
  TargetConfig,
  TargetsConfig,
} from "./lib/types.js";

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
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

  validateProjectsConfig(config, projectIds);
  validateTargetsConfig(targetsConfig, config, projectIds);

  const configuredProjects = config.projects ?? [];
  const configuredTokenFiles = new Set(
    configuredProjects.map((project) => normalizeRepoPath(project.tokenFile)),
  );
  const unregisteredProjects = discoverTokenProjects(rootDir).filter(
    (project) =>
      !configuredTokenFiles.has(normalizeRepoPath(project.tokenFile)),
  );
  const selectedProjectIds = getValidationSelectedProjectIds();
  if (selectedProjectIds) {
    const knownProjectIds = new Set([
      ...configuredProjects.map((project) => project.id),
      ...unregisteredProjects.map((project) => project.id),
    ]);
    for (const projectId of selectedProjectIds) {
      if (!knownProjectIds.has(projectId)) {
        throw new Error(`Unknown token project selected: ${projectId}`);
      }
    }
  }
  const selectedProjects = configuredProjects.filter(
    (project) => !selectedProjectIds || selectedProjectIds.has(project.id),
  );
  const selectedUnregisteredProjects = unregisteredProjects.filter(
    (project) => !selectedProjectIds || selectedProjectIds.has(project.id),
  );
  let missingTokenFiles = 0;
  for (const project of selectedProjects) {
    const tokenPath = path.join(rootDir, project.tokenFile);
    if (!fs.existsSync(tokenPath)) {
      console.log(`Skipping ${project.id}: waiting for ${project.tokenFile}.`);
      missingTokenFiles += 1;
      continue;
    }
    const tokens = readTokenDocument(tokenPath);
    validateTokenDocument(tokens, project.tokenFile);
    validatedTokenFiles += 1;
  }

  for (const project of selectedUnregisteredProjects) {
    const tokenPath = path.join(rootDir, project.tokenFile);
    const tokens = readTokenDocument(tokenPath);
    validateTokenDocument(tokens, project.tokenFile);
    validatedTokenFiles += 1;
    console.log(
      `Validated ${project.tokenFile}; waiting for project configuration.`,
    );
  }

  console.log(`Validated ${validatedTokenFiles} token file(s).`);
  if (missingTokenFiles > 0) {
    console.log(`Skipped ${missingTokenFiles} project(s) without tokens.json.`);
  }
  if (selectedUnregisteredProjects.length > 0) {
    console.log(
      `${selectedUnregisteredProjects.length} token file(s) without project configuration.`,
    );
  }
}

function getValidationSelectedProjectIds(): Set<string> | null {
  if (!("TOKEN_VALIDATION_PROJECTS" in process.env)) {
    return getSelectedProjectIds();
  }
  return getSelectedProjectIds(process.argv.slice(2), {
    ...process.env,
    TOKEN_PROJECTS: process.env.TOKEN_VALIDATION_PROJECTS,
  });
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function validateProjectsConfig(
  projectsConfig: ProjectsConfig,
  projectIds: Set<string>,
): void {
  rejectUnknownFields(projectsConfig, ["projects"], "projects.config.json");
  if (!Array.isArray(projectsConfig.projects)) {
    throw new Error('projects.config.json: "projects" must be an array.');
  }

  for (const [index, project] of projectsConfig.projects.entries()) {
    const pathPrefix = `projects.config.json.projects[${index}]`;
    rejectUnknownFields(project, ["id", "tokenFile", "outputDir"], pathPrefix);
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
    if (
      path.isAbsolute(project.tokenFile) ||
      project.tokenFile.includes("..")
    ) {
      throw new Error(`${pathPrefix}.tokenFile must be repository-relative.`);
    }
    if (
      path.isAbsolute(project.outputDir) ||
      project.outputDir.includes("..")
    ) {
      throw new Error(`${pathPrefix}.outputDir must be repository-relative.`);
    }
  }
}

export function validateTargetsConfig(
  targetsConfig: TargetsConfig,
  projectsConfig: ProjectsConfig,
  projectIds: Set<string>,
): void {
  rejectUnknownFields(targetsConfig, ["targets"], "targets.config.json");
  if (!Array.isArray(targetsConfig.targets)) {
    throw new Error('targets.config.json: "targets" must be an array.');
  }

  const outputByProject = new Map(
    (projectsConfig.projects ?? []).map((project) => [
      project.id,
      project.outputDir,
    ]),
  );
  const destinations: Array<{
    repo: string;
    branch: string;
    path: string;
    field: string;
  }> = [];

  for (const [index, target] of targetsConfig.targets.entries()) {
    const pathPrefix = `targets.config.json.targets[${index}]`;
    rejectUnknownFields(
      target,
      ["project", "repo", "branch", "source", "destination", "delivery"],
      pathPrefix,
    );
    requireString(target.project, `${pathPrefix}.project`);
    requireString(target.repo, `${pathPrefix}.repo`);
    requireString(target.branch, `${pathPrefix}.branch`);
    requireString(target.source, `${pathPrefix}.source`);
    requireString(target.destination?.css, `${pathPrefix}.destination.css`);
    rejectUnknownFields(
      target.destination,
      ["css", "json", "manifest"],
      `${pathPrefix}.destination`,
    );
    validateDeliveryConfig(target.delivery, `${pathPrefix}.delivery`);

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
      const candidate = {
        repo: target.repo.toLocaleLowerCase(),
        branch: target.branch.toLocaleLowerCase(),
        path: value.replace(/\\/g, "/").replace(/\/+$/, "").toLocaleLowerCase(),
        field: `${pathPrefix}.destination.${field}`,
      };
      const conflict = destinations.find(
        (existing) =>
          existing.repo === candidate.repo &&
          existing.branch === candidate.branch &&
          pathsOverlap(existing.path, candidate.path),
      );
      if (conflict)
        throw new Error(`${candidate.field} conflicts with ${conflict.field}.`);
      destinations.push(candidate);
    }
  }
}

function validateDeliveryConfig(
  delivery: TargetConfig["delivery"],
  pathPrefix: string,
): void {
  if (delivery === undefined) return;
  if (
    delivery === null ||
    typeof delivery !== "object" ||
    Array.isArray(delivery)
  ) {
    throw new Error(`${pathPrefix} must be an object.`);
  }
  rejectUnknownFields(
    delivery,
    [
      "provider",
      "branchPrefix",
      "branchName",
      "title",
      "body",
      "reviewers",
      "labels",
    ],
    pathPrefix,
  );

  if (delivery.provider !== undefined) {
    requireString(delivery.provider, `${pathPrefix}.provider`);
    if (delivery.provider !== "github") {
      throw new Error(
        `${pathPrefix}.provider must be "github"; provider ${delivery.provider} is not implemented.`,
      );
    }
  }

  for (const [field, value] of [
    ["branchPrefix", delivery.branchPrefix],
    ["branchName", delivery.branchName],
    ["title", delivery.title],
    ["body", delivery.body],
  ] as const) {
    if (value === undefined) continue;
    requireString(value, `${pathPrefix}.${field}`);
  }

  for (const [field, value] of [
    ["reviewers", delivery.reviewers],
    ["labels", delivery.labels],
  ] as const) {
    if (value === undefined) continue;
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== "string" || !item.trim())
    ) {
      throw new Error(
        `${pathPrefix}.${field} must be an array of non-empty strings.`,
      );
    }
  }
}

function rejectUnknownFields(
  value: unknown,
  allowedFields: readonly string[],
  pathPrefix: string,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  if (unknown) {
    throw new Error(`${pathPrefix}.${unknown} is not a recognized field.`);
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}
