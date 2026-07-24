import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getChangelogSection,
  parseProjectReleaseTag,
  sha256File,
} from "../scripts/lib/release.js";
import { createProjectReleaseAssets } from "../scripts/build-project-release.js";
import type { ProjectReleaseManifest } from "../scripts/build-project-release.js";
import { getProjectReleaseInfo } from "../scripts/release-info.js";

test("project release tags use the configured project and stable version", () => {
  assert.deepEqual(parseProjectReleaseTag("site-v1.2.0"), {
    projectId: "site",
    version: "1.2.0",
  });
  assert.throws(
    () => parseProjectReleaseTag("design-tokens-site-v0.1.0-rc.1"),
    /must be <project-id>-v<version>/,
  );
  assert.equal(
    getChangelogSection(
      "# Changelog\n\n## 1.2.0\n\n- Ready.\n\n## 1.1.0\n\n- Older.",
      "1.2.0",
    ),
    "- Ready.\n",
  );
});

test("release info rejects a tag that differs from project configuration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-info-"));
  const projectDir = path.join(root, "token-definitions/projects/site");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "tokens.json"), "{}");
  fs.writeFileSync(
    path.join(projectDir, "CHANGELOG.md"),
    "# Changelog\n\n## 1.2.0\n\n- Ready.\n",
  );
  fs.writeFileSync(
    path.join(root, "projects.config.json"),
    JSON.stringify({
      projects: [
        {
          id: "site",
          tokenFile: "token-definitions/projects/site/tokens.json",
          outputDir: "dist/site",
          packageName: "@ekinotech/design-tokens-site",
          version: "1.2.0",
          documentationSlug: "site",
          enabled: true,
        },
      ],
    }),
  );
  assert.deepEqual(getProjectReleaseInfo(root, "site-v1.2.0"), {
    projectId: "site",
    version: "1.2.0",
    tag: "site-v1.2.0",
    changelogPath: "token-definitions/projects/site/CHANGELOG.md",
  });
  assert.throws(
    () => getProjectReleaseInfo(root, "site-v1.3.0"),
    /does not match configured version/,
  );
});

test("project release creates one tgz and one full zip", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-release-"));
  const packageDir = path.join(root, "package");
  const storybookDir = path.join(root, "storybook");
  const artifactsDir = path.join(root, "artifacts");
  fs.mkdirSync(path.join(packageDir, "css"), { recursive: true });
  fs.mkdirSync(storybookDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@ekinotech/design-tokens-site",
      version: "0.2.0",
    }),
  );
  fs.writeFileSync(path.join(packageDir, "css/default.css"), ":root {}");
  fs.writeFileSync(path.join(storybookDir, "index.html"), "<main>Guide</main>");
  const packageArchive = path.join(root, "package.tgz");
  fs.writeFileSync(packageArchive, "installable package");
  const info: ProjectReleaseManifest = {
    formatVersion: 1,
    component: "project-tokens",
    projectId: "site",
    packageName: "@ekinotech/design-tokens-site",
    version: "0.2.0",
    tag: "site-v0.2.0",
    documentationSlug: "site",
    centralVersion: "0.1.0",
    centralCommit: "abc123",
    validatorVersion: "0.1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    install: { packageSpec: "@ekinotech/design-tokens-site@0.2.0" },
    artifacts: {
      package: "design-tokens-site-v0.2.0.tgz",
      bundle: "design-tokens-site-v0.2.0.zip",
    },
    outputs: {
      css: ["light.css"],
      themes: [{ group: "Mode", id: "light", name: "Light" }],
    },
  };
  const result = createProjectReleaseAssets({
    artifactsDir,
    packageArchive,
    packageDir,
    storybookDir,
    info,
  });
  assert.deepEqual(fs.readdirSync(artifactsDir).sort(), [
    "design-tokens-site-v0.2.0.tgz",
    "design-tokens-site-v0.2.0.zip",
    "release-notes.md",
  ]);
  const zipFiles = execFileSync(
    "unzip",
    ["-Z1", path.join(artifactsDir, result.bundleAsset)],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((file) => file && !file.endsWith("/"));
  assert.deepEqual(zipFiles.sort(), [
    "BUILD_INFO.json",
    "checksums.txt",
    "package/css/default.css",
    "package/package.json",
    "storybook/index.html",
  ]);
  assert.equal(
    JSON.parse(
      execFileSync(
        "unzip",
        ["-p", path.join(artifactsDir, result.bundleAsset), "BUILD_INFO.json"],
        { encoding: "utf8" },
      ),
    ).tag,
    "site-v0.2.0",
  );
  const extracted = path.join(root, "extracted");
  fs.mkdirSync(extracted);
  execFileSync("unzip", [
    "-q",
    path.join(artifactsDir, result.bundleAsset),
    "-d",
    extracted,
  ]);
  const checksumLines = fs
    .readFileSync(path.join(extracted, "checksums.txt"), "utf8")
    .trim()
    .split("\n");
  for (const line of checksumLines) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match);
    assert.equal(sha256File(path.join(extracted, match[2]!)), match[1]);
  }
  const notes = fs.readFileSync(
    path.join(artifactsDir, result.notesAsset),
    "utf8",
  );
  assert.match(notes, /npm install @ekinotech\/design-tokens-site@0\.2\.0/);
  assert.match(notes, /SHA-256: `[0-9a-f]{64}`/);
  assert.throws(
    () =>
      createProjectReleaseAssets({
        artifactsDir,
        packageArchive,
        packageDir,
        storybookDir,
        info,
      }),
    /Refusing to overwrite/,
  );
});
