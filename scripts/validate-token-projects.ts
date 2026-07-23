import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { discoverTokenProjects } from "./lib/project-discovery.js";
import { getChangelogSection, parsePackageVersion } from "./lib/release.js";
import {
  getSelectedProjectIds,
  getSelectedProjects,
} from "./lib/project-selection.js";
import {
  getProjectsConfig,
  readTokenDocument,
  validateTokenDocument,
} from "./lib/token-utils.js";
import type { ProjectsConfig, TokenProject } from "./lib/types.js";

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

function main(): void {
  const rootDir = process.cwd();
  const config = getProjectsConfig(rootDir);
  validateProjectsConfig(config, rootDir);
  const configured = config.projects ?? [];
  const configuredTokenFiles = new Set(
    configured.map((project) => normalizeRepoPath(project.tokenFile)),
  );
  const unregistered = discoverTokenProjects(rootDir).filter(
    (project) =>
      !configuredTokenFiles.has(normalizeRepoPath(project.tokenFile)),
  );
  const selectedIds = getValidationSelectedProjectIds();
  const knownIds = new Set([
    ...configured.map((project) => project.id),
    ...unregistered.map((project) => project.id),
  ]);
  if (selectedIds)
    for (const id of selectedIds)
      if (!knownIds.has(id))
        throw new Error(`Unknown token project selected: ${id}`);

  const selected = getSelectedProjects(configured, selectedIds);
  const selectedUnregistered = unregistered.filter(
    (project) => !selectedIds || selectedIds.has(project.id),
  );
  let validated = 0;
  for (const project of selected) {
    const tokenPath = path.join(rootDir, project.tokenFile);
    validateTokenDocument(readTokenDocument(tokenPath), project.tokenFile);
    validated += 1;
  }
  for (const project of selectedUnregistered) {
    validateTokenDocument(
      readTokenDocument(path.join(rootDir, project.tokenFile)),
      project.tokenFile,
    );
    validated += 1;
    console.log(
      `Validated ${project.tokenFile}; waiting for project configuration.`,
    );
  }
  console.log(`Validated ${validated} token file(s).`);
  if (selectedUnregistered.length)
    console.log(
      `${selectedUnregistered.length} token file(s) without project configuration.`,
    );
}

function getValidationSelectedProjectIds(): Set<string> | null {
  if (!("TOKEN_VALIDATION_PROJECTS" in process.env))
    return getSelectedProjectIds();
  return getSelectedProjectIds(process.argv.slice(2), {
    ...process.env,
    TOKEN_PROJECTS: process.env.TOKEN_VALIDATION_PROJECTS,
  });
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function validateProjectsConfig(
  config: ProjectsConfig,
  rootDir?: string,
): void {
  rejectUnknownFields(config, ["projects"], "projects.config.json");
  if (!Array.isArray(config.projects))
    throw new Error('projects.config.json: "projects" must be an array.');
  const ids = new Set<string>();
  const packageNames = new Set<string>();
  const documentationSlugs = new Set<string>();
  const outputs: Array<{ path: string; field: string }> = [];
  for (const [index, project] of config.projects.entries()) {
    const prefix = `projects.config.json.projects[${index}]`;
    rejectUnknownFields(
      project,
      [
        "id",
        "tokenFile",
        "outputDir",
        "packageName",
        "version",
        "documentationSlug",
        "enabled",
        "disabledReason",
      ],
      prefix,
    );
    for (const field of [
      "id",
      "tokenFile",
      "outputDir",
      "packageName",
      "version",
      "documentationSlug",
    ] as const)
      requireString(project[field], `${prefix}.${field}`);
    if (typeof project.enabled !== "boolean")
      throw new Error(`${prefix}.enabled must be a boolean.`);
    rejectDuplicate(ids, project.id, `${prefix}.id`);
    rejectDuplicate(packageNames, project.packageName, `${prefix}.packageName`);
    rejectDuplicate(
      documentationSlugs,
      project.documentationSlug,
      `${prefix}.documentationSlug`,
    );
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id))
      throw new Error(
        `${prefix}.id must be a lowercase kebab-case project ID.`,
      );
    if (project.packageName !== `@ekinotech/design-tokens-${project.id}`)
      throw new Error(
        `${prefix}.packageName must be @ekinotech/design-tokens-${project.id}.`,
      );
    const parsedVersion = parsePackageVersion(project.version);
    if (parsedVersion.rc !== null)
      throw new Error(`${prefix}.version must be a stable SemVer version.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.documentationSlug))
      throw new Error(
        `${prefix}.documentationSlug must be a lowercase kebab-case slug.`,
      );
    if (!project.enabled) {
      requireString(project.disabledReason, `${prefix}.disabledReason`);
    } else if (project.disabledReason !== undefined) {
      throw new Error(
        `${prefix}.disabledReason is allowed only when enabled is false.`,
      );
    }
    if (!project.tokenFile.endsWith("/tokens.json"))
      throw new Error(`${prefix}.tokenFile must point to a tokens.json file.`);
    for (const field of ["tokenFile", "outputDir"] as const)
      assertSafeRepoPath(project[field], `${prefix}.${field}`);
    if (
      project.enabled &&
      rootDir &&
      !fs.existsSync(path.join(rootDir, project.tokenFile))
    )
      throw new Error(
        `${prefix}.tokenFile does not exist for enabled project ${project.id}: ${project.tokenFile}.`,
      );
    if (project.enabled && rootDir) {
      const changelogPath = path.join(
        rootDir,
        path.dirname(project.tokenFile),
        "CHANGELOG.md",
      );
      if (!fs.existsSync(changelogPath))
        throw new Error(
          `${prefix} requires ${normalizeRepoPath(path.relative(rootDir, changelogPath))}.`,
        );
      getChangelogSection(
        fs.readFileSync(changelogPath, "utf8"),
        project.version,
      );
    }
    const normalizedOutput = normalizeRepoPath(project.outputDir).replace(
      /\/$/,
      "",
    );
    const conflict = outputs.find((item) =>
      pathsOverlap(item.path.toLowerCase(), normalizedOutput.toLowerCase()),
    );
    if (conflict)
      throw new Error(`${prefix}.outputDir overlaps ${conflict.field}.`);
    outputs.push({ path: normalizedOutput, field: `${prefix}.outputDir` });
  }
}

function rejectDuplicate(
  values: Set<string>,
  value: string,
  field: string,
): void {
  if (values.has(value)) throw new Error(`${field} duplicates ${value}.`);
  values.add(value);
}
function assertSafeRepoPath(value: string, field: string): void {
  if (
    path.isAbsolute(value) ||
    value.split(/[\\/]/).includes("..") ||
    value.trim() !== value ||
    !value
  )
    throw new Error(`${field} must be a safe repository-relative path.`);
}
function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}
function rejectUnknownFields(
  value: unknown,
  allowed: readonly string[],
  prefix: string,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const known = new Set(allowed);
  const unknown = Object.keys(value).find((field) => !known.has(field));
  if (unknown)
    throw new Error(`${prefix}.${unknown} is not a recognized field.`);
}
function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} must be a non-empty string.`);
}
