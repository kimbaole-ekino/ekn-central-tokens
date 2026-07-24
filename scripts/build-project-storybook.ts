import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveEffectiveTokens,
  resolveThemePermutations,
} from "@ekinotech/design-token-validator";
import { buildProject } from "./build-token-artifacts.js";
import {
  getSelectedProjectIds,
  getSelectedProjects,
} from "./lib/project-selection.js";
import { getCentralBuildIdentity } from "./lib/build-identity.js";
import {
  getProjectsConfig,
  readJson,
  readTokenDocument,
  writeFile,
} from "./lib/token-utils.js";
import type { TokenProject } from "./lib/types.js";
import { parsePackageVersion } from "./lib/release.js";

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const requestedVersion = arg("--version");
  const sourceCommit = arg("--source-commit") ?? commit(root);
  const selectedIds = getSelectedProjectIds();
  const projects = getSelectedProjects(
    getProjectsConfig(root).projects ?? [],
    selectedIds,
  );
  if (process.argv.includes("--serve") && projects.length !== 1)
    throw new Error(
      "Storybook dev requires exactly one --project=<project-id>.",
    );
  for (const project of projects) {
    if (!fs.existsSync(path.join(root, project.tokenFile))) {
      if (selectedIds)
        throw new Error(
          `${project.id} token file does not exist: ${project.tokenFile}.`,
        );
      console.log(`Skipping ${project.id}: waiting for ${project.tokenFile}.`);
      continue;
    }
    if (process.argv.includes("--serve")) {
      await buildProject(project, root);
      writeGuide(project, {
        root,
        version: requestedVersion ?? project.version,
        sourceCommit,
      });
      execFileSync(
        path.join(root, "node_modules/.bin/storybook"),
        ["dev", "-p", "6006", "--config-dir", ".storybook"],
        {
          cwd: root,
          stdio: "inherit",
          env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" },
        },
      );
    } else {
      await buildProjectStorybook(project, {
        root,
        version: requestedVersion ?? project.version,
        sourceCommit,
      });
    }
  }
}

export async function buildProjectStorybook(
  project: TokenProject,
  options: { root: string; version: string; sourceCommit: string },
): Promise<string> {
  parsePackageVersion(options.version);
  await buildProject(project, options.root);
  writeGuide(project, options);
  return buildStaticStorybook(project, options);
}

export function writeGuide(
  project: TokenProject,
  options: { root: string; version: string; sourceCommit: string },
): void {
  const document = readTokenDocument(
    path.join(options.root, project.tokenFile),
  );
  const contexts = resolveThemePermutations(document);
  const rawDir = path.join(options.root, project.outputDir, "raw");
  const manifest = readJson<{
    outputs: Record<
      string,
      { css: string; json: string; themes: Array<{ id: string }> }
    >;
  }>(path.join(rawDir, "manifest.json"));
  const cssNames = mapCssVariableNames(contexts, manifest, rawDir);
  const tokens = contexts.flatMap((context) => {
    const graph = resolveEffectiveTokens(document, context);
    if (graph.diagnostics.length)
      throw new Error(
        graph.diagnostics
          .map((item) => `${item.code}: ${item.message}`)
          .join("\n"),
      );
    return [...graph.tokens.values()].map((token) => ({
      context: context.id,
      name: token.tokenPath,
      type: token.type,
      rawValue: token.rawValue,
      resolvedValue: token.resolvedValue,
      aliasTarget: token.aliasTarget,
      sourceSet: token.definingSet,
      winningSet: token.winningSet,
      cssVariable: cssNames.get(`${context.id}\0${token.tokenPath}`),
      description: token.definitions.find(
        (definition) => definition.tokenSet === token.winningSet,
      )?.leaf.description,
      section: sectionFor(token.type, token.tokenPath),
    }));
  });
  const buildIdentity = getCentralBuildIdentity(
    options.root,
    options.sourceCommit,
  );
  const guide = {
    projectId: project.id,
    packageName: project.packageName,
    version: options.version,
    ...buildIdentity,
    tokenSets: document.$metadata?.tokenSetOrder ?? [],
    contexts: contexts.map((context) => ({
      name: context.id,
      themes: context.themes.map(({ id, name, group }) => ({
        id,
        name,
        group,
      })),
    })),
    cssFiles: Object.values(manifest.outputs)
      .map((output) => output.css)
      .sort(),
    tokens,
  };
  writeFile(
    path.join(options.root, "storybook/generated-guide.mjs"),
    `export const guide = ${JSON.stringify(guide, null, 2)};\n`,
  );
}

function mapCssVariableNames(
  contexts: ReturnType<typeof resolveThemePermutations>,
  manifest: {
    outputs: Record<
      string,
      { css: string; json: string; themes: Array<{ id: string }> }
    >;
  },
  rawDir: string,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const context of contexts) {
    const ids = context.themes.map((theme) => theme.id);
    const output = Object.values(manifest.outputs).find(
      (entry) =>
        entry.themes.map((theme) => theme.id).join("\0") === ids.join("\0"),
    );
    if (!output)
      throw new Error(`No raw output maps to Storybook context ${context.id}.`);
    const paths = Object.keys(
      readJson<Record<string, unknown>>(path.join(rawDir, output.json)),
    );
    const names = [
      ...fs
        .readFileSync(path.join(rawDir, output.css), "utf8")
        .matchAll(/^\s*--([a-zA-Z0-9-]+):/gm),
    ].map((match) => `--${match[1]}`);
    if (paths.length !== names.length)
      throw new Error(`CSS variable mapping mismatch for ${context.id}.`);
    paths.forEach((tokenPath, index) =>
      result.set(`${context.id}\0${tokenPath}`, names[index]!),
    );
  }
  return result;
}

function buildStaticStorybook(
  project: TokenProject,
  options: { root: string; version: string; sourceCommit: string },
): string {
  const output = path.join(options.root, project.outputDir, "storybook-static");
  fs.rmSync(output, { recursive: true, force: true });
  execFileSync(
    path.join(options.root, "node_modules/.bin/storybook"),
    ["build", "--config-dir", ".storybook", "--output-dir", output],
    {
      cwd: options.root,
      stdio: "inherit",
      env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" },
    },
  );
  if (!fs.existsSync(path.join(output, "index.html")))
    throw new Error(`${project.id} Storybook did not produce index.html.`);
  writeFile(
    path.join(output, "project-build.json"),
    `${JSON.stringify(
      {
        projectId: project.id,
        packageName: project.packageName,
        version: options.version,
        ...getCentralBuildIdentity(options.root, options.sourceCommit),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Built Storybook ${project.id}@${options.version}`);
  return output;
}
function sectionFor(type: string, tokenPath: string): string {
  const value = `${type} ${tokenPath}`.toLowerCase();
  if (value.includes("color")) return "colors";
  if (/font|typograph/.test(value)) return "typography";
  if (/spacing|space|dimension|size/.test(value)) return "spacing";
  if (/radius/.test(value)) return "radius";
  if (/border|stroke/.test(value)) return "borders";
  if (/shadow/.test(value)) return "shadows";
  if (/opacity/.test(value)) return "opacity";
  return "other";
}
function arg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
}
function commit(root: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "local";
  }
}
