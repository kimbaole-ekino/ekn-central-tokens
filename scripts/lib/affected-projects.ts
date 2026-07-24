import type { TokenProject } from "./types.js";

const SHARED_PATHS = [
  "scripts/",
  "storybook/",
  ".storybook/",
  "package.json",
  "package-lock.json",
];

export interface AffectedResult {
  affected: string[];
  validation: string[];
}
export function fallbackAffectedProjects(
  projects: TokenProject[],
  discoveredIds: string[],
): AffectedResult {
  const affected = projects
    .filter((project) => project.enabled)
    .map((project) => project.id)
    .sort();
  return {
    affected,
    validation: [...new Set([...affected, ...discoveredIds])].sort(),
  };
}
export function detectAffectedProjects(
  changedFiles: string[],
  before: TokenProject[],
  after: TokenProject[],
  discoveredIds: string[],
): AffectedResult {
  const affected = new Set<string>();
  const validation = new Set<string>();
  const configuredIds = new Set(after.map((project) => project.id));
  const currentIds = new Set(
    after.filter((project) => project.enabled).map((project) => project.id),
  );
  let all = false;
  for (const file of changedFiles) {
    const direct = /^token-definitions\/projects\/([^/]+)\//.exec(file)?.[1];
    if (direct) {
      affected.add(direct);
      validation.add(direct);
      continue;
    }
    if (file === "projects.config.json") {
      for (const id of changedConfigIds(before, after)) {
        affected.add(id);
        validation.add(id);
      }
      continue;
    }
    if (
      SHARED_PATHS.some((shared) =>
        shared.endsWith("/") ? file.startsWith(shared) : file === shared,
      )
    )
      all = true;
  }
  if (all)
    for (const id of currentIds) {
      affected.add(id);
      validation.add(id);
    }
  for (const id of discoveredIds) if (affected.has(id)) validation.add(id);
  return {
    affected: [...affected].filter((id) => currentIds.has(id)).sort(),
    validation: [...validation]
      .filter(
        (id) =>
          currentIds.has(id) ||
          (!configuredIds.has(id) && discoveredIds.includes(id)),
      )
      .sort(),
  };
}
export function changedConfigIds(
  before: TokenProject[],
  after: TokenProject[],
): string[] {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  return [...new Set([...beforeById.keys(), ...afterById.keys()])]
    .filter((id) => stable(beforeById.get(id)) !== stable(afterById.get(id)))
    .sort();
}
function stable(value: unknown): string {
  if (value === undefined) return "";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
    .join(",")}}`;
}
