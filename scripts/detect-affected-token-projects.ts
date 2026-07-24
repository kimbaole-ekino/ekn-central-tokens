import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { discoverTokenProjects } from "./lib/project-discovery.js";
import {
  detectAffectedProjects,
  fallbackAffectedProjects,
} from "./lib/affected-projects.js";
import { getProjectsConfig } from "./lib/token-utils.js";
import type { ProjectsConfig, TokenProject } from "./lib/types.js";
import { validateProjectsConfig } from "./validate-token-projects.js";

const root = process.cwd();
try {
  const current = getProjectsConfig(root);
  validateProjectsConfig(current, root);
  const base = arg("--base") ?? process.env.AFFECTED_BASE_REF;
  const head = arg("--head") ?? process.env.AFFECTED_HEAD_REF ?? "HEAD";
  let result;
  if (
    !base ||
    /^0{40}$/.test(base) ||
    !commitExists(base) ||
    !commitExists(head)
  ) {
    console.warn(
      "Base or head commit is unavailable; selecting every token project.",
    );
    result = fallbackAffectedProjects(
      current.projects ?? [],
      discoverTokenProjects(root).map((project) => project.id),
    );
  } else {
    result = detectAffectedProjects(
      changedFiles(base, head),
      readProjectsAt(base),
      current.projects ?? [],
      discoverTokenProjects(root).map((project) => project.id),
    );
  }
  emit("TOKEN_PROJECTS", result.affected.join(","));
  emit("TOKEN_VALIDATION_PROJECTS", result.validation.join(","));
  report("Affected token projects", result.affected);
  report("Token projects selected for validation", result.validation);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function changedFiles(base: string, head: string): string[] {
  return execFileSync("git", ["diff", "--name-only", base, head], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
function commitExists(ref: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
function readProjectsAt(ref: string): TokenProject[] {
  try {
    return (
      (
        JSON.parse(
          execFileSync("git", ["show", `${ref}:projects.config.json`], {
            cwd: root,
            encoding: "utf8",
          }),
        ) as ProjectsConfig
      ).projects ?? []
    );
  } catch {
    return [];
  }
}
function arg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
function emit(envName: string, value: string): void {
  if (process.env.GITHUB_ENV)
    fs.appendFileSync(process.env.GITHUB_ENV, `${envName}=${value}\n`);
  else console.log(`${envName}=${value}`);
}
function report(label: string, values: string[]): void {
  console.log(`${label}: ${values.length ? values.join(", ") : "none"}`);
}
