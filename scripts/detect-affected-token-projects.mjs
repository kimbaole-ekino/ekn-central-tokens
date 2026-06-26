import { execFileSync } from "node:child_process";
import fs from "node:fs";
import {
  getProjectsConfig,
  getTargetsConfig,
} from "./token-build-utils.mjs";

const rootDir = process.cwd();
const baseRef = getArgValue("--base") ?? process.env.AFFECTED_BASE_REF;
const headRef = getArgValue("--head") ?? process.env.AFFECTED_HEAD_REF ?? "HEAD";
const currentProjectsConfig = getProjectsConfig(rootDir);
const currentTargetsConfig = getTargetsConfig(rootDir);
const currentProjects = currentProjectsConfig.projects ?? [];
const currentProjectIds = new Set(currentProjects.map((project) => project.id));
const affectedProjectIds = new Set();
let buildAll = false;

if (!baseRef) {
  buildAll = true;
} else if (isZeroCommit(baseRef)) {
  console.warn(
    "Base ref is the zero commit; falling back to all token projects.",
  );
  buildAll = true;
} else if (!commitExists(baseRef)) {
  console.warn(
    `Base ref ${baseRef} is not available locally; falling back to all token projects.`,
  );
  buildAll = true;
} else if (!commitExists(headRef)) {
  console.warn(
    `Head ref ${headRef} is not available locally; falling back to all token projects.`,
  );
  buildAll = true;
} else {
  const changedFiles = getChangedFiles(baseRef, headRef);
  const baseProjectsConfig = readJsonAtRef(baseRef, "projects.config.json") ?? {
    projects: [],
  };
  const baseTargetsConfig = readJsonAtRef(baseRef, "targets.config.json") ?? {
    targets: [],
  };

  for (const filePath of changedFiles) {
    markAffectedByPath(filePath, baseProjectsConfig, baseTargetsConfig);
  }
}

const selectedProjectIds = buildAll
  ? currentProjects.map((project) => project.id)
  : [...affectedProjectIds].filter((projectId) => currentProjectIds.has(projectId));

emitGithubEnv("TOKEN_PROJECTS", selectedProjectIds.join(","));
emitGithubEnv("TARGET_DELIVERY_PROJECTS", selectedProjectIds.join(","));

console.log(
  selectedProjectIds.length > 0
    ? `Affected token projects: ${selectedProjectIds.join(", ")}`
    : "Affected token projects: none",
);

function markAffectedByPath(filePath, baseProjectsConfig, baseTargetsConfig) {
  const tokenMatch = filePath.match(/^token-definitions\/projects\/([^/]+)\//);
  if (tokenMatch) {
    affectedProjectIds.add(tokenMatch[1]);
    return;
  }

  const blockPoolMatch = filePath.match(/^blocks\/pools\/([^/]+)\//);
  if (blockPoolMatch) {
    addProjectsUsingBlockPool(blockPoolMatch[1]);
    return;
  }

  if (filePath === "projects.config.json") {
    addChangedConfigProjects(
      baseProjectsConfig.projects ?? [],
      currentProjectsConfig.projects ?? [],
    );
    return;
  }

  if (filePath === "targets.config.json") {
    addChangedConfigProjects(
      baseTargetsConfig.targets ?? [],
      currentTargetsConfig.targets ?? [],
      "project",
    );
    return;
  }

  if (
    filePath.startsWith("scripts/") ||
    filePath === "package.json" ||
    filePath === "package-lock.json" ||
    filePath === ".github/workflows/token-ci.yml"
  ) {
    buildAll = true;
  }
}

function addProjectsUsingBlockPool(poolName) {
  let matched = false;
  for (const project of currentProjects) {
    if ((project.blockPools ?? []).includes(poolName)) {
      affectedProjectIds.add(project.id);
      matched = true;
    }
  }

  if (!matched) buildAll = true;
}

function addChangedConfigProjects(beforeItems, afterItems, idField = "id") {
  const beforeById = mapById(beforeItems, idField);
  const afterById = mapById(afterItems, idField);
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);

  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (stableStringify(before) !== stableStringify(after)) {
      affectedProjectIds.add(id);
    }
  }
}

function mapById(items, idField) {
  return new Map(
    items
      .filter((item) => item && typeof item[idField] === "string")
      .map((item) => [item[idField], item]),
  );
}

function getChangedFiles(base, head) {
  try {
    return execFileSync("git", ["diff", "--name-only", base, head], {
      cwd: rootDir,
      encoding: "utf8",
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `Unable to diff ${base}..${head}; falling back to all token projects.`,
    );
    if (error.stderr) console.warn(String(error.stderr).trim());
    buildAll = true;
    return [];
  }
}

function commitExists(ref) {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function isZeroCommit(ref) {
  return /^0{40}$/.test(ref);
}

function readJsonAtRef(ref, filePath) {
  try {
    const content = execFileSync("git", ["show", `${ref}:${filePath}`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function stableStringify(value) {
  if (value === undefined) return "";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function emitGithubEnv(name, value) {
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
  } else {
    console.log(`${name}=${value}`);
  }
}
