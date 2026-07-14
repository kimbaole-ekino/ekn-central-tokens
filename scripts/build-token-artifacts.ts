import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveEffectiveTokens,
  resolveThemePermutations,
  type EffectiveThemeContext,
} from "@eknvn/token-validator";
import {
  getSelectedProjectIds,
  getSelectedProjects,
} from "./lib/project-selection.js";
import {
  getProjectsConfig,
  readTokenDocument,
  validateTokenDocument,
  writeFile,
} from "./lib/token-utils.js";
import type {
  BuildManifest,
  TokenDocument,
  TokenProject,
} from "./lib/types.js";
import { buildEffectiveGraphWithStyleDictionary } from "./lib/style-dictionary.js";

const MAX_THEME_PERMUTATIONS = 20;

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await main();

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const config = getProjectsConfig(rootDir);
  const selected = getSelectedProjectIds();
  const projects = getSelectedProjects(config.projects ?? [], selected);
  if (selected && projects.length === 0)
    console.log("No token projects selected for artifact build.");
  for (const project of projects) await buildProject(project, rootDir);
}

export async function buildProject(
  project: TokenProject,
  rootDir = process.cwd(),
): Promise<void> {
  const tokenPath = path.join(rootDir, project.tokenFile);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `${project.id} token file does not exist: ${project.tokenFile}.`,
    );
  }
  const document = readTokenDocument(tokenPath);
  validateTokenDocument(document, project.tokenFile);
  const outputDir = path.resolve(rootDir, project.outputDir);
  const root = path.resolve(rootDir);
  if (!outputDir.startsWith(`${root}${path.sep}`))
    throw new Error(
      `${project.id} outputDir must remain inside the repository.`,
    );
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const contexts = derivedContexts(document, project.id);
  const artifactPaths = new Set<string>();
  const manifest: BuildManifest = { projectId: project.id, outputs: {} };
  for (const context of contexts) {
    const orderedThemes = orderContextThemes(document, context);
    const outputId = normalizeOutputId(
      orderedThemes.map((theme) => theme.name).join("-"),
    );
    const artifactBasePath = getArtifactBasePath(orderedThemes);
    const artifactCollisionKey = artifactBasePath.toLocaleLowerCase();
    if (artifactPaths.has(artifactCollisionKey))
      throw new Error(
        `Theme output collision: both themes generate ${artifactBasePath}.css`,
      );
    artifactPaths.add(artifactCollisionKey);
    const graph = resolveEffectiveTokens(document, context);
    if (graph.diagnostics.length)
      throw new Error(
        graph.diagnostics
          .map((item) => `${item.code}: ${item.message}`)
          .join("\n"),
      );
    const files = await buildEffectiveGraphWithStyleDictionary({
      graph,
      outputDir,
      outputId,
      artifactBasePath,
    });
    const manifestKey = manifest.outputs[outputId]
      ? artifactBasePath
      : outputId;
    manifest.outputs[manifestKey] = {
      themes: orderedThemes.map((theme) => ({
        group: theme.group,
        id: theme.id,
        name: theme.name,
      })),
      ...files,
    };
  }
  writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Built ${project.id} into ${project.outputDir}`);
}

function orderContextThemes(
  document: TokenDocument,
  context: EffectiveThemeContext,
) {
  const groupOrder = [
    ...new Set((document.$themes ?? []).map((theme) => theme.group)),
  ];
  return [...context.themes].sort(
    (left, right) =>
      groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group),
  );
}

export function getArtifactBasePath(
  themes: EffectiveThemeContext["themes"],
): string {
  if (themes.length === 0) throw new Error("Artifact context has no Themes.");
  const names = themes.map((theme) => normalizeOutputId(theme.name));
  if (themes.length === 1) return names[0]!;
  return names.join("/");
}

export function derivedContexts(
  document: TokenDocument,
  projectId: string,
): EffectiveThemeContext[] {
  try {
    return resolveThemePermutations(document, {
      maxPermutations: MAX_THEME_PERMUTATIONS,
    });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(
      `${projectId} exceeds the internal limit of ${MAX_THEME_PERMUTATIONS} Theme permutations derived from tokens.json.${detail}`,
    );
  }
}
export function normalizeOutputId(value: string): string {
  const result = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!result || result === "." || result === "..")
    throw new Error(`Unsafe output ID: ${value}.`);
  return result;
}
