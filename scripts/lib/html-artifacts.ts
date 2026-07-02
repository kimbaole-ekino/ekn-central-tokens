import fs from "node:fs";
import path from "node:path";
import type { BuildTheme, TokenProject } from "./types.js";
import {
  asObject,
  escapeHtml,
  readJson,
  renderTemplate,
  writeFile,
} from "./token-utils.js";

interface BlockContract {
  id?: unknown;
  template?: unknown;
}

interface BlockExample {
  props?: unknown;
  slots?: unknown;
}

interface BlockChild {
  type?: unknown;
  props?: unknown;
}

export function writeHtmlDemo(
  outputDir: string,
  cssFile: string,
  referenceCssFile: string | undefined,
  themes: BuildTheme[],
  htmlManifest: Record<string, string>,
): void {
  const [defaultTheme, scopedTheme] = themes;
  if (!defaultTheme) {
    throw new Error("Cannot write HTML demo without at least one theme.");
  }

  const scopedExample = scopedTheme
    ? [
        "",
        `    <section class="demo" data-color-scheme="${scopedTheme.outputId}">`,
        `      <h2>Scoped ${escapeHtml(scopedTheme.name)} Section</h2>`,
        "      <button>Scoped Button</button>",
        "    </section>",
      ].join("\n")
    : "";
  const htmlFile = "html/demo.html";
  const referenceCssLink = referenceCssFile
    ? [`    <link rel="stylesheet" href="../${referenceCssFile}" />`]
    : [];
  const html = [
    "<!-- Do not edit directly, this file was auto-generated. -->",
    "",
    "<!doctype html>",
    `<html data-color-scheme="${defaultTheme.outputId}">`,
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>Design Token Demo</title>",
    ...referenceCssLink,
    `    <link rel="stylesheet" href="../${cssFile}" />`,
    "  </head>",
    "  <body>",
    '    <section class="demo">',
    "      <h1>Design Token Demo</h1>",
    "      <button>Example Button</button>",
    `    </section>${scopedExample}`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");

  writeFile(path.join(outputDir, htmlFile), html);
  htmlManifest.demo = htmlFile;
}

export function writeBlockExamples(
  rootDir: string,
  outputDir: string,
  project: TokenProject,
  htmlManifest: Record<string, string>,
): void {
  for (const poolName of project.blockPools ?? []) {
    const poolDir = path.join(rootDir, "blocks", "pools", poolName);
    if (!fs.existsSync(poolDir)) continue;

    for (const blockName of fs.readdirSync(poolDir)) {
      const blockDir = path.join(poolDir, blockName);
      const contractPath = path.join(blockDir, "block.json");
      const examplesPath = path.join(blockDir, "examples.json");
      if (!fs.existsSync(contractPath) || !fs.existsSync(examplesPath)) {
        continue;
      }

      const contract = readJson<BlockContract>(contractPath);
      if (typeof contract.id !== "string") {
        throw new Error(`${contractPath} must include a string id.`);
      }
      if (typeof contract.template !== "string") {
        throw new Error(`${contractPath} must include a string template.`);
      }

      const template = fs.readFileSync(
        path.join(blockDir, contract.template),
        "utf8",
      );
      const examples = readJson<{ examples?: BlockExample[] }>(
        examplesPath,
      ).examples;
      const example = examples?.[0];
      if (!example) continue;

      const slotOutput: Record<string, string> = {};
      const slots = asObject(example.slots) ?? {};
      for (const [slotName, children] of Object.entries(slots)) {
        if (!Array.isArray(children)) continue;
        slotOutput[slotName] = children
          .map((child) => renderChildBlock(poolDir, child))
          .join("\n");
      }

      const html = renderTemplate(
        template,
        asObject(example.props) ?? {},
        slotOutput,
      );
      const htmlFile = `html/${contract.id}.html`;
      writeFile(path.join(outputDir, htmlFile), `${html.trim()}\n`);
      htmlManifest[contract.id] = htmlFile;
    }
  }
}

function renderChildBlock(
  poolDir: string,
  child: BlockChild,
): string {
  if (typeof child.type !== "string") {
    throw new Error("Block child must include a string type.");
  }

  const blockDir = path.join(poolDir, child.type);
  const contract = readJson<BlockContract>(path.join(blockDir, "block.json"));
  if (typeof contract.template !== "string") {
    throw new Error(`${child.type} block contract must include a template.`);
  }

  const template = fs.readFileSync(
    path.join(blockDir, contract.template),
    "utf8",
  );
  return renderTemplate(template, asObject(child.props) ?? {});
}
