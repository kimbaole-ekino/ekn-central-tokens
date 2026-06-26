import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  getProjectsConfig,
  getTargetsConfig,
} from "./token-build-utils.mjs";

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const isApplyMode =
  args.has("--apply") || process.env.TARGET_DELIVERY_APPLY === "true";
const selectedProject =
  getArgValue("--project") ?? process.env.TARGET_DELIVERY_PROJECT ?? "";
const selectedProjects = getSelectedProjectIds();
const config = getTargetsConfig(rootDir);
const projectsConfig = getProjectsConfig(rootDir);
const projectById = new Map(
  (projectsConfig.projects ?? []).map((project) => [project.id, project]),
);
const targets = (config.targets ?? []).filter((target) => {
  if (selectedProjects) return selectedProjects.has(target.project);
  return !selectedProject || target.project === selectedProject;
});

if (selectedProjects && selectedProjects.size === 0) {
  console.log("No token projects selected for target delivery.");
  process.exit(0);
}

if (targets.length === 0) {
  throw new Error(
    selectedProject
      ? `No target delivery config found for project ${selectedProject}.`
      : "No target delivery config found.",
  );
}

if (isApplyMode) {
  assertCommand("git", ["--version"]);
  assertCommand("gh", ["--version"]);
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    throw new Error(
      "TARGET_DELIVERY_APPLY=true requires GH_TOKEN or GITHUB_TOKEN with access to target repositories.",
    );
  }
}

for (const target of targets) {
  const project = validateTarget(target);
  if (isPendingFirstSyncProject(project)) {
    console.log(
      `Skipping target delivery for ${target.project}: ${project.tokenFile} does not exist yet. It will be created by the first plugin PR/MR.`,
    );
    continue;
  }
  validateBuiltArtifacts(target);
  const delivery = buildDelivery(target);
  printDelivery(delivery, isApplyMode ? "apply" : "dry-run");

  if (isApplyMode) {
    createTargetMergeRequest(delivery);
  }
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function getSelectedProjectIds() {
  const values = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--projects=")) {
      values.push(...arg.slice("--projects=".length).split(","));
    }
  }

  if ("TARGET_DELIVERY_PROJECTS" in process.env) {
    values.push(...process.env.TARGET_DELIVERY_PROJECTS.split(","));
  }

  const selected = values.map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? new Set(selected) : null;
}

function validateTarget(target) {
  const requiredStrings = [
    ["project", target.project],
    ["repo", target.repo],
    ["branch", target.branch],
    ["source", target.source],
    ["destination.css", target.destination?.css],
    ["destination.html", target.destination?.html],
  ];

  for (const [field, value] of requiredStrings) {
    if (!value || typeof value !== "string") {
      throw new Error(`${target.project ?? "target"} is missing ${field}.`);
    }
  }

  const project = projectById.get(target.project);
  if (!project) {
    throw new Error(`${target.project} does not exist in projects.config.json.`);
  }
  if (target.source !== project.outputDir) {
    throw new Error(
      `${target.project} source must match projects.config.json outputDir (${project.outputDir}).`,
    );
  }

  return project;
}

function isPendingFirstSyncProject(project) {
  return !fs.existsSync(path.join(rootDir, project.tokenFile));
}

function validateBuiltArtifacts(target) {
  const sourceDir = path.join(rootDir, target.source);
  const manifestPath = path.join(sourceDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing built manifest for ${target.project}: ${manifestPath}`,
    );
  }
}

function buildDelivery(target) {
  const sourceDir = path.join(rootDir, target.source);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"),
  );
  const branchName =
    target.delivery?.branchName ??
    `${target.delivery?.branchPrefix ?? "tokens/"}${target.project}-${manifest.version}`;
  const title =
    target.delivery?.title ??
    `Update ${target.project} design token artifacts`;
  const body =
    target.delivery?.body ??
    [
      "Automated delivery from `ekn-central-tokens`.",
      "",
      `- Project: \`${target.project}\``,
      `- Artifact version: \`${manifest.version}\``,
      `- Source artifact: \`${target.source}\``,
      "",
      "The target project maintainer must review, run target CI, and merge.",
    ].join("\n");

  return {
    target,
    sourceDir,
    manifest,
    branchName,
    title,
    body,
    mappings: getMappings(sourceDir, target.destination),
    reviewers: target.delivery?.reviewers ?? [],
    labels: target.delivery?.labels ?? [],
  };
}

function getMappings(sourceDir, destination) {
  const mappings = [
    {
      label: "css",
      source: path.join(sourceDir, "css"),
      destination: destination.css,
      type: "directory",
    },
    {
      label: "html",
      source: path.join(sourceDir, "html"),
      destination: destination.html,
      type: "directory",
    },
  ];

  if (destination.json) {
    mappings.push({
      label: "json",
      source: path.join(sourceDir, "json"),
      destination: destination.json,
      type: "directory",
    });
  }

  if (destination.manifest) {
    mappings.push({
      label: "manifest",
      source: path.join(sourceDir, "manifest.json"),
      destination: destination.manifest,
      type: "file",
    });
  }

  for (const mapping of mappings) {
    if (!fs.existsSync(mapping.source)) {
      throw new Error(`Missing ${mapping.label} artifact: ${mapping.source}`);
    }
  }

  return mappings;
}

function printDelivery(delivery, mode) {
  console.log(
    [
      `Target delivery MR for ${delivery.target.project}`,
      `Mode: ${mode}`,
      `Repo: ${delivery.target.repo}`,
      `Base branch: ${delivery.target.branch}`,
      `Delivery branch: ${delivery.branchName}`,
      `Source: ${delivery.target.source}`,
      `Title: ${delivery.title}`,
      "Artifact mappings:",
      ...delivery.mappings.map(
        (mapping) =>
          `- ${path.relative(rootDir, mapping.source)} -> ${mapping.destination}`,
      ),
      "Merge authority: target project maintainer review and merge.",
    ].join("\n"),
  );
}

function createTargetMergeRequest(delivery) {
  const workDir = path.join(rootDir, ".delivery", delivery.target.project);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(workDir), { recursive: true });

  run("gh", [
    "repo",
    "clone",
    delivery.target.repo,
    workDir,
    "--",
    "--branch",
    delivery.target.branch,
  ]);

  run("git", [
    "remote",
    "set-url",
    "--push",
    "origin",
    getAuthenticatedGitHubRemote(delivery.target.repo),
  ], { cwd: workDir });
  run("git", ["checkout", "-B", delivery.branchName], { cwd: workDir });

  for (const mapping of delivery.mappings) {
    const destination = path.join(workDir, mapping.destination);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(mapping.source, destination, { recursive: true });
  }

  run("git", ["add", "-A"], { cwd: workDir });

  const status = run("git", ["status", "--porcelain"], {
    cwd: workDir,
    stdio: "pipe",
  }).trim();

  if (!status) {
    console.log(`No target changes for ${delivery.target.project}; skipping PR.`);
    return;
  }

  run("git", [
    "config",
    "user.name",
    process.env.TARGET_DELIVERY_GIT_USER_NAME ?? "ekn-token-delivery-bot",
  ], { cwd: workDir });
  run("git", [
    "config",
    "user.email",
    process.env.TARGET_DELIVERY_GIT_USER_EMAIL ??
      "ekn-token-delivery-bot@example.invalid",
  ], { cwd: workDir });
  run("git", ["commit", "-m", delivery.title], { cwd: workDir });
  run("git", [
    "push",
    "--force-with-lease",
    "--set-upstream",
    "origin",
    delivery.branchName,
  ], { cwd: workDir });

  const existingPr = findOpenPullRequest(delivery);
  if (existingPr) {
    run("gh", [
      "pr",
      "edit",
      existingPr,
      "--title",
      delivery.title,
      "--body",
      delivery.body,
    ]);
    console.log(`Updated target PR: ${existingPr}`);
    return;
  }

  const createArgs = [
    "pr",
    "create",
    "--repo",
    delivery.target.repo,
    "--base",
    delivery.target.branch,
    "--head",
    delivery.branchName,
    "--title",
    delivery.title,
    "--body",
    delivery.body,
  ];

  for (const reviewer of delivery.reviewers) {
    createArgs.push("--reviewer", reviewer);
  }

  for (const label of delivery.labels) {
    createArgs.push("--label", label);
  }

  const prUrl = run("gh", createArgs, { stdio: "pipe" }).trim();
  console.log(`Created target PR: ${prUrl}`);
}

function findOpenPullRequest(delivery) {
  return run(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      delivery.target.repo,
      "--base",
      delivery.target.branch,
      "--head",
      delivery.branchName,
      "--state",
      "open",
      "--json",
      "url",
      "--jq",
      ".[0].url",
    ],
    { stdio: "pipe" },
  ).trim();
}

function getAuthenticatedGitHubRemote(repo) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "Target delivery apply mode requires GH_TOKEN or GITHUB_TOKEN.",
    );
  }

  const ownerRepo = getGitHubOwnerRepo(repo);
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${ownerRepo}.git`;
}

function getGitHubOwnerRepo(repo) {
  const shorthandMatch = repo.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (shorthandMatch) {
    return `${shorthandMatch[1]}/${shorthandMatch[2]}`;
  }

  const sshMatch = repo.match(/^git@github\.com:([^/\s]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  try {
    const url = new URL(repo);
    if (url.hostname === "github.com") {
      const [owner, name] = url.pathname
        .replace(/^\/|\.git$/g, "")
        .split("/");
      if (owner && name) return `${owner}/${name}`;
    }
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error(
    `${repo} must be a GitHub owner/repo shorthand or github.com URL for authenticated target delivery.`,
  );
}

function assertCommand(command, args) {
  try {
    run(command, args, { stdio: "ignore" });
  } catch {
    throw new Error(`${command} is required for target MR delivery.`);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
    },
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
  });
}
