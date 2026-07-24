import StyleDictionary from "style-dictionary";
import { register as registerTokenTransforms } from "@tokens-studio/sd-transforms";
import {
  tokenSetFromFlatTokens,
  type ResolvedTokenGraph,
  type TokenLeaf,
} from "@ekinotech/design-token-validator";
import { writeFile } from "./token-utils.js";

const GENERATED_FILE_HEADER =
  "/* Do not edit directly, this file was auto-generated. */";
interface DictionaryToken {
  name?: string;
  path?: string[];
  value?: unknown;
  $value?: unknown;
  type?: string;
  $type?: string;
}
let registered = false;
function registerStyleDictionaryTransforms(): void {
  if (!registered) {
    registerTokenTransforms(StyleDictionary);
    registered = true;
  }
}

export async function buildEffectiveGraphWithStyleDictionary(options: {
  graph: ResolvedTokenGraph;
  outputDir: string;
  outputId: string;
  artifactBasePath?: string;
}): Promise<{ css: string; json: string }> {
  registerStyleDictionaryTransforms();
  const flat = new Map<string, TokenLeaf>();
  for (const [path, token] of options.graph.tokens)
    flat.set(path, { type: token.type, value: token.resolvedValue });
  const dictionary = new StyleDictionary({
    tokens: tokenSetFromFlatTokens(flat) as never,
    preprocessors: ["tokens-studio"],
    platforms: {
      output: { transformGroup: "tokens-studio", transforms: ["name/kebab"] },
    },
  });
  const built = (await dictionary.getPlatformTokens("output")) as {
    allTokens?: DictionaryToken[];
  };
  const records = (built.allTokens ?? []).map((token) => ({
    path: token.path?.join(".") ?? "",
    name: token.name ?? "",
    value: token.$value ?? token.value,
    type: token.$type ?? token.type,
  }));
  assertNoNameCollisions(records, options.graph);
  records.sort((left, right) => left.path.localeCompare(right.path));
  const cssNameByPath = new Map(
    records.map((token) => [token.path, token.name]),
  );
  const artifactBasePath = options.artifactBasePath ?? options.outputId;
  const cssPath = `${artifactBasePath}.css`;
  const jsonPath = `${artifactBasePath}.json`;
  const selector = `:root[data-color-scheme="${options.outputId}"],\n[data-color-scheme="${options.outputId}"]`;
  const css = `${GENERATED_FILE_HEADER}\n\n${selector} {\n${records.map((token) => `  --${token.name}: ${formatCssTokenValue(token, options.graph, cssNameByPath)};`).join("\n")}\n}\n`;
  const json = `${JSON.stringify(Object.fromEntries(records.map((token) => [token.path, { type: token.type, value: token.value }])), null, 2)}\n`;
  writeFile(`${options.outputDir}/${cssPath}`, css);
  writeFile(`${options.outputDir}/${jsonPath}`, json);
  return { css: cssPath, json: jsonPath };
}

function formatCssTokenValue(
  token: { path: string; value: unknown },
  graph: ResolvedTokenGraph,
  cssNameByPath: Map<string, string>,
): string {
  const aliasTarget = graph.tokens.get(token.path)?.aliasTarget;
  const targetName = aliasTarget ? cssNameByPath.get(aliasTarget) : undefined;
  return targetName ? `var(--${targetName})` : formatCssValue(token.value);
}

function assertNoNameCollisions(
  records: Array<{ path: string; name: string }>,
  graph: ResolvedTokenGraph,
): void {
  const seen = new Map<string, string>();
  for (const token of records) {
    const key = token.name.toLocaleLowerCase();
    const previous = seen.get(key);
    if (previous && previous !== token.path) {
      const left = graph.tokens.get(previous);
      const right = graph.tokens.get(token.path);
      throw new Error(
        `TRANSFORMED_OUTPUT_COLLISION: ${previous} (${left?.winningSet}) and ${token.path} (${right?.winningSet}) both map to --${token.name} in ${graph.context.id}.`,
      );
    }
    seen.set(key, token.path);
  }
}
function formatCssValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}
