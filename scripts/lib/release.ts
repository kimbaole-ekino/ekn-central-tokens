import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface PackageVersion {
  major: number;
  minor: number;
  patch: number;
  rc: number | null;
}

const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/;

export function parsePackageVersion(value: string): PackageVersion {
  const match = VERSION_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid package version: ${value}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rc: match[4] ? Number(match[4]) : null,
  };
}

export interface ProjectReleaseTag {
  projectId: string;
  version: string;
}

export function parseProjectReleaseTag(tag: string): ProjectReleaseTag {
  const match =
    /^([a-z0-9]+(?:-[a-z0-9]+)*)-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(
      tag,
    );
  if (!match) {
    throw new Error(
      `Project release tag must be <project-id>-v<version>, received ${tag}.`,
    );
  }
  return { projectId: match[1]!, version: match[2]! };
}

export function getChangelogSection(
  changelog: string,
  version: string,
): string {
  const parsed = parsePackageVersion(version);
  if (parsed.rc !== null) {
    throw new Error(`Project release version must be stable: ${version}.`);
  }
  const escaped = version.replace(/\./g, "\\.");
  const start = new RegExp(`^## ${escaped}\\s*$`, "m").exec(changelog);
  if (!start) {
    throw new Error(`Project changelog has no ## ${version} section.`);
  }
  const contentStart = start.index + start[0].length;
  const remaining = changelog.slice(contentStart);
  const next = /^##\s+/m.exec(remaining);
  const content = remaining.slice(0, next?.index).trim();
  if (!content) {
    throw new Error(`Project changelog ## ${version} is empty.`);
  }
  return `${content}\n`;
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function writeTreeChecksums(
  directory: string,
  outputName = "checksums.txt",
): void {
  const files = listFiles(directory).filter((file) => file !== outputName);
  const content = files
    .map((file) => `${sha256File(path.join(directory, file))}  ${file}`)
    .join("\n");
  fs.writeFileSync(path.join(directory, outputName), `${content}\n`);
}

function listFiles(directory: string, prefix = ""): string[] {
  return fs
    .readdirSync(path.join(directory, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(prefix, entry.name);
      return entry.isDirectory() ? listFiles(directory, relative) : [relative];
    })
    .sort();
}
