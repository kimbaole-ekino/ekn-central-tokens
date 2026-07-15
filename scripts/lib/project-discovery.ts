import fs from "node:fs";
import path from "node:path";

export interface DiscoveredTokenProject {
  id: string;
  tokenFile: string;
}

export function discoverTokenProjects(
  rootDir: string,
): DiscoveredTokenProject[] {
  const projectsDir = path.join(rootDir, "token-definitions", "projects");
  if (!fs.existsSync(projectsDir)) return [];

  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      tokenFile: path.posix.join(
        "token-definitions",
        "projects",
        entry.name,
        "tokens.json",
      ),
    }))
    .filter((project) => fs.existsSync(path.join(rootDir, project.tokenFile)))
    .sort((left, right) => left.id.localeCompare(right.id));
}
