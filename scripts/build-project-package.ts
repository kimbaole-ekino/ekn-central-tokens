import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildProject } from "./build-token-artifacts.js";
import {
  getSelectedProjectIds,
  getSelectedProjects,
} from "./lib/project-selection.js";
import { getCentralBuildIdentity } from "./lib/build-identity.js";
import { parsePackageVersion } from "./lib/release.js";
import { getProjectsConfig, readJson, writeFile } from "./lib/token-utils.js";
import type { BuildManifest, TokenProject } from "./lib/types.js";

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
  const requestedVersion = getArg("--version");
  const sourceCommit = getArg("--source-commit") ?? getCommit(root);
  const projects = getSelectedProjects(
    getProjectsConfig(root).projects ?? [],
    getSelectedProjectIds(),
  );
  const explicitlySelected = getSelectedProjectIds() !== null;
  for (const project of projects) {
    if (!fs.existsSync(path.join(root, project.tokenFile))) {
      if (explicitlySelected)
        throw new Error(
          `${project.id} token file does not exist: ${project.tokenFile}.`,
        );
      console.log(`Skipping ${project.id}: waiting for ${project.tokenFile}.`);
      continue;
    }
    await buildProjectPackage(project, {
      root,
      version: requestedVersion ?? project.version,
      sourceCommit,
    });
  }
}

export async function buildProjectPackage(
  project: TokenProject,
  options: { root: string; version: string; sourceCommit: string },
): Promise<ProjectPackagePaths> {
  parsePackageVersion(options.version);
  await buildProject(project, options.root);
  const projectDir = safeProjectDir(options.root, project.outputDir);
  const rawDir = path.join(projectDir, "raw");
  const packageDir = path.join(projectDir, "package");
  const packagesDir = path.join(projectDir, "packages");
  fs.rmSync(packageDir, { recursive: true, force: true });
  fs.rmSync(packagesDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(packageDir, "css"), { recursive: true });
  fs.mkdirSync(packagesDir, { recursive: true });
  const manifest = readJson<BuildManifest>(path.join(rawDir, "manifest.json"));
  const cssFiles = Object.values(manifest.outputs)
    .map((output) => output.css)
    .sort();
  if (!cssFiles.length)
    throw new Error(`${project.id} did not generate any CSS output.`);
  for (const cssFile of cssFiles) {
    const source = path.resolve(rawDir, cssFile);
    if (!source.startsWith(`${rawDir}${path.sep}`) || !fs.existsSync(source))
      throw new Error(`Missing safe CSS output: ${cssFile}`);
    const destination = path.join(packageDir, "css", cssFile);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  const exports = Object.fromEntries(
    cssFiles.map((file) => [`./${file}`, `./css/${file}`]),
  );
  const packageJson = {
    name: project.packageName,
    version: options.version,
    description: `Generated design tokens for ${project.id}`,
    type: "module",
    files: ["css", "README.md", "project-build.json"],
    exports,
    sideEffects: ["**/*.css"],
  };
  const buildMetadata = {
    projectId: project.id,
    packageName: project.packageName,
    version: options.version,
    ...getCentralBuildIdentity(options.root, options.sourceCommit),
    cssFiles,
  };
  writeFile(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  writeFile(
    path.join(packageDir, "project-build.json"),
    `${JSON.stringify(buildMetadata, null, 2)}\n`,
  );
  writeFile(
    path.join(packageDir, "README.md"),
    packageReadme(project, options.version, cssFiles),
  );

  const baseName = `design-tokens-${project.id}-v${options.version}`;
  const packed = JSON.parse(
    execFileSync(
      "npm",
      [
        "pack",
        "--json",
        "--pack-destination",
        packagesDir,
        "--cache",
        path.join(options.root, ".npm"),
      ],
      { cwd: packageDir, encoding: "utf8" },
    ),
  ) as Array<{ filename?: string }>;
  if (!packed[0]?.filename)
    throw new Error(`npm pack did not create ${project.id} package.`);
  const packageAsset = `${baseName}.tgz`;
  fs.renameSync(
    path.join(packagesDir, packed[0].filename),
    path.join(packagesDir, packageAsset),
  );
  console.log(`Built package ${project.packageName}@${options.version}`);
  return { projectDir, packagesDir, packageAsset };
}

export interface ProjectPackagePaths {
  projectDir: string;
  packagesDir: string;
  packageAsset: string;
}
function safeProjectDir(root: string, outputDir: string): string {
  const resolved = path.resolve(root, outputDir);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("Project output must remain inside the repository.");
  return resolved;
}
function getCommit(root: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "local";
  }
}
function getArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}
function packageReadme(
  project: TokenProject,
  version: string,
  cssFiles: string[],
): string {
  return `# ${project.packageName}\n\nGenerated CSS for project \`${project.id}\`, version \`${version}\`.\n\nInstall the local archive, then import one supported CSS file:\n\n\`\`\`sh\nnpm install ./design-tokens-${project.id}-v${version}.tgz\n\`\`\`\n\n${cssFiles.map((file) => `- \`${project.packageName}/${file}\``).join("\n")}\n`;
}
