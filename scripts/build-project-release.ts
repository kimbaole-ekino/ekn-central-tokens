import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildProjectPackage } from "./build-project-package.js";
import { buildProjectStorybook } from "./build-project-storybook.js";
import { getCentralBuildIdentity } from "./lib/build-identity.js";
import { getSelectedProjects } from "./lib/project-selection.js";
import {
  parsePackageVersion,
  sha256File,
  writeTreeChecksums,
} from "./lib/release.js";
import { getProjectsConfig, readJson, writeFile } from "./lib/token-utils.js";
import type { BuildManifest, TokenProject } from "./lib/types.js";

export interface ProjectReleaseManifest {
  formatVersion: 1;
  component: "project-tokens";
  projectId: string;
  packageName: string;
  version: string;
  tag: string;
  documentationSlug: string;
  centralVersion: string;
  centralCommit: string;
  validatorVersion: string;
  createdAt: string;
  install: {
    packageSpec: string;
  };
  artifacts: {
    package: string;
    bundle: string;
  };
  outputs: {
    css: string[];
    themes: Array<{ group: string; id: string; name: string }>;
  };
}

export interface ProjectReleasePaths {
  artifactsDir: string;
  packageAsset: string;
  bundleAsset: string;
  notesAsset: string;
}

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
  const projectId = requiredArg("--project");
  const version = requiredArg("--version");
  const sourceCommit = requiredArg("--source-commit");
  const [project] = getSelectedProjects(
    getProjectsConfig(root).projects ?? [],
    new Set([projectId]),
  );
  if (!project) throw new Error(`Unknown project ID: ${projectId}.`);
  if (!fs.existsSync(path.join(root, project.tokenFile))) {
    throw new Error(
      `${project.id} token file does not exist: ${project.tokenFile}.`,
    );
  }
  await buildProjectRelease(project, {
    root,
    version,
    sourceCommit,
  });
}

export async function buildProjectRelease(
  project: TokenProject,
  options: {
    root: string;
    version: string;
    sourceCommit: string;
    createdAt?: string;
  },
): Promise<ProjectReleasePaths> {
  parsePackageVersion(options.version);
  if (project.version !== options.version) {
    throw new Error(
      `${project.id} build version ${options.version} does not match configured version ${project.version}.`,
    );
  }
  const packagePaths = await buildProjectPackage(project, options);
  const storybookDir = await buildProjectStorybook(project, options);
  const artifactsDir = path.join(packagePaths.projectDir, "artifacts");
  const baseName = `design-tokens-${project.id}-v${options.version}`;
  const packageAsset = `${baseName}.tgz`;
  const bundleAsset = `${baseName}.zip`;
  const rawManifest = readJson<BuildManifest>(
    path.join(packagePaths.projectDir, "raw/manifest.json"),
  );
  const tag = `${project.id}-v${options.version}`;
  const buildIdentity = getCentralBuildIdentity(
    options.root,
    options.sourceCommit,
  );
  const manifest: ProjectReleaseManifest = {
    formatVersion: 1,
    component: "project-tokens",
    projectId: project.id,
    packageName: project.packageName,
    version: options.version,
    tag,
    documentationSlug: project.documentationSlug,
    ...buildIdentity,
    createdAt: options.createdAt ?? new Date().toISOString(),
    install: {
      packageSpec: `${project.packageName}@${options.version}`,
    },
    artifacts: {
      package: packageAsset,
      bundle: bundleAsset,
    },
    outputs: {
      css: Object.values(rawManifest.outputs)
        .map((output) => output.css)
        .sort(),
      themes: Object.values(rawManifest.outputs).flatMap(
        (output) => output.themes,
      ),
    },
  };
  const result = createProjectReleaseAssets({
    artifactsDir,
    packageArchive: path.join(
      packagePaths.packagesDir,
      packagePaths.packageAsset,
    ),
    packageDir: path.join(packagePaths.projectDir, "package"),
    storybookDir,
    info: manifest,
  });
  console.log(`Built project release ${manifest.tag}`);
  return result;
}

export function createProjectReleaseAssets(input: {
  artifactsDir: string;
  packageArchive: string;
  packageDir: string;
  storybookDir: string;
  info: ProjectReleaseManifest;
}): ProjectReleasePaths {
  fs.mkdirSync(input.artifactsDir, { recursive: true });
  const { package: packageAsset, bundle: bundleAsset } = input.info.artifacts;
  const notesAsset = "release-notes.md";
  for (const file of [packageAsset, bundleAsset, notesAsset]) {
    const target = path.join(input.artifactsDir, file);
    if (fs.existsSync(target)) {
      throw new Error(`Refusing to overwrite existing release file: ${target}`);
    }
  }
  fs.copyFileSync(
    input.packageArchive,
    path.join(input.artifactsDir, packageAsset),
  );
  const staging = fs.mkdtempSync(
    path.join(os.tmpdir(), "ekn-project-release-"),
  );
  try {
    fs.cpSync(input.packageDir, path.join(staging, "package"), {
      recursive: true,
    });
    fs.cpSync(input.storybookDir, path.join(staging, "storybook"), {
      recursive: true,
    });
    writeFile(
      path.join(staging, "BUILD_INFO.json"),
      `${JSON.stringify(input.info, null, 2)}\n`,
    );
    writeTreeChecksums(staging);
    normalizeArchiveTimes(staging);
    execFileSync(
      "zip",
      ["-X", "-q", "-r", path.join(input.artifactsDir, bundleAsset), "."],
      { cwd: staging },
    );
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  const packageSha256 = sha256File(path.join(input.artifactsDir, packageAsset));
  const bundleSha256 = sha256File(path.join(input.artifactsDir, bundleAsset));
  writeFile(
    path.join(input.artifactsDir, notesAsset),
    releaseNotes(input.info, packageSha256, bundleSha256),
  );
  return {
    artifactsDir: input.artifactsDir,
    packageAsset,
    bundleAsset,
    notesAsset,
  };
}

function normalizeArchiveTimes(directory: string): void {
  const archiveDate = new Date("1980-01-01T00:00:00.000Z");
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) normalizeArchiveTimes(target);
    fs.utimesSync(target, archiveDate, archiveDate);
  }
  fs.utimesSync(directory, archiveDate, archiveDate);
}

function releaseNotes(
  info: ProjectReleaseManifest,
  packageSha256: string,
  bundleSha256: string,
): string {
  const packageInstall = `\nInstall the exact package from GitHub Packages:\n\n\`\`\`sh\nnpm install ${info.install.packageSpec}\n\`\`\`\n`;
  return `# ${info.projectId} Design Tokens v${info.version}\n\n- Package: \`${info.packageName}\`\n- Tag: \`${info.tag}\`\n- Central: \`${info.centralVersion}\` at \`${info.centralCommit}\`\n- Validator: \`${info.validatorVersion}\`\n\n## Assets\n\n- \`${info.artifacts.package}\` SHA-256: \`${packageSha256}\`\n- \`${info.artifacts.bundle}\` SHA-256: \`${bundleSha256}\`\n${packageInstall}\nThe package is published to GitHub Packages. The \`.zip\` contains the matching package directory, Storybook, build metadata, and checksums.\n`;
}

function requiredArg(name: string): string {
  const value = optionalArg(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}
