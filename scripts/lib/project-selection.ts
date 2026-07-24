import type { TokenProject } from "./types.js";

export function getSelectedProjectIds(
  argv = process.argv.slice(2),
  env = process.env,
): Set<string> | null {
  const values: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--project=")) {
      values.push(arg.slice("--project=".length));
    }
    if (arg.startsWith("--projects=")) {
      values.push(...arg.slice("--projects=".length).split(","));
    }
  }

  if ("TOKEN_PROJECTS" in env && typeof env.TOKEN_PROJECTS === "string") {
    values.push(...env.TOKEN_PROJECTS.split(","));
  }

  const selected = values.map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? new Set(selected) : null;
}

export function getSelectedProjects(
  projects: TokenProject[],
  selectedProjectIds: Set<string> | null,
): TokenProject[] {
  if (!selectedProjectIds) return projects.filter((project) => project.enabled);

  const knownProjectIds = new Set(projects.map((project) => project.id));
  for (const projectId of selectedProjectIds) {
    if (!knownProjectIds.has(projectId)) {
      throw new Error(`Unknown token project selected: ${projectId}`);
    }
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project?.enabled) {
      throw new Error(
        `${projectId} is disabled: ${project?.disabledReason ?? "no reason was provided"}.`,
      );
    }
  }

  return projects.filter((project) => selectedProjectIds.has(project.id));
}
