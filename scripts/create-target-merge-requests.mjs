import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getTargetsConfig } from "./token-build-utils.mjs";

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const isApplyMode =
  args.has("--apply") || process.env.TARGET_DELIVERY_APPLY === "true";
const selectedProject =
  getArgValue("--project") ?? process.env.TARGET_DELIVERY_PROJECT ?? "";
const config = getTargetsConfig(rootDir);
const targets = (config.targets ?? []).filter(
  (target) => !selectedProject || target.project === selectedProject,
);

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
  validateTarget(target);
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
