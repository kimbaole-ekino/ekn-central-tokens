import fs from "node:fs";
import path from "node:path";
import type {
  ProjectsConfig,
  TargetConfig,
  TargetsConfig,
  TokenDocument,
  TokenLeaf,
  TokenNode,
  TokensStudioTheme,
} from "./types.js";

export function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function getProjectsConfig(rootDir: string): ProjectsConfig {
  return readJson(path.join(rootDir, "projects.config.json"));
}

export function getTargetsConfig(rootDir: string): TargetsConfig {
  return readJson(path.join(rootDir, "targets.config.json"));
}

export function getTokenSetNames(document: TokenDocument): string[] {
  const actual = Object.keys(document).filter((key) => !key.startsWith("$"));
  const metadata = asObject(document.$metadata);
  const tokenSetOrder = Array.isArray(metadata?.tokenSetOrder)
    ? metadata.tokenSetOrder.filter(
        (name): name is string =>
          typeof name === "string" && actual.includes(name),
      )
    : [];
  return [
    ...tokenSetOrder,
    ...actual.filter((name) => !tokenSetOrder.includes(name)),
  ];
}

export function flattenTokens(
  document: TokenDocument,
  selectedSets = getTokenSetNames(document),
): Map<string, TokenLeaf> {
  const output = new Map<string, TokenLeaf>();

  function walk(node: unknown, prefix: string): void {
    if (!isObject(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (isTokenLeaf(value)) {
        output.set(currentPath, value);
      } else if (isObject(value)) {
        walk(value, currentPath);
      }
    }
  }

  for (const setName of selectedSets) {
    const set = document[setName];
    if (isObject(set)) {
      walk(set, setName);
    }
  }

  return output;
}

export function isTokenLeaf(value: unknown): value is TokenLeaf {
  return (
    isObject(value) &&
    ("value" in value ||
      "type" in value ||
      "$value" in value ||
      "$type" in value)
  );
}

export function getLeafValue(leaf: TokenLeaf): unknown {
  return "value" in leaf ? leaf.value : leaf.$value;
}

export function getLeafType(leaf: TokenLeaf): unknown {
  return "type" in leaf ? leaf.type : leaf.$type;
}

export function cssVariableName(tokenPath: string): string {
  return `--${tokenPath
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}`;
}

export function resolveAlias(
  value: unknown,
  tokens: Map<string, TokenLeaf>,
  chain: string[] = [],
): unknown {
  if (typeof value !== "string") return value;
  const match = value.match(/^\{([^{}]+)\}$/);
  if (!match) return value;
  const aliasPath = match[1]!;
  if (chain.includes(aliasPath)) {
    throw new Error(`Cyclic alias: ${[...chain, aliasPath].join(" -> ")}`);
  }
  const target = tokens.get(aliasPath);
  if (!target) {
    throw new Error(`Unresolved alias: ${aliasPath}`);
  }
  return resolveAlias(getLeafValue(target), tokens, [...chain, aliasPath]);
}

export function validateTokenDocument(
  document: TokenDocument,
  sourceName: string,
): void {
  const errors: string[] = [];
  const stableIds = new Map<string, string>();
  const tokenSets = new Set(getTokenSetNames(document));
  const allTokens = flattenTokens(document);

  if (!Array.isArray(document.$themes) || document.$themes.length === 0) {
    errors.push("root: missing non-empty $themes array");
  }

  function validateNode(node: unknown, currentPath: string): void {
    if (isTokenLeaf(node)) {
      const value = getLeafValue(node);
      const type = getLeafType(node);
      if (!type) errors.push(`${currentPath}: missing type`);
      if (value === undefined) errors.push(`${currentPath}: missing value`);
      const id = node.$extensions?.ekinoTokenArchitect?.id;
      if (typeof id === "string") {
        if (stableIds.has(id)) {
          errors.push(`${currentPath}: duplicate stable token ID ${id}`);
        }
        stableIds.set(id, currentPath);
      }
      return;
    }

    if (!isObject(node)) {
      errors.push(`${currentPath || "root"}: invalid node`);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (currentPath === "" && key.startsWith("$")) continue;
      if (
        key.trim() !== key ||
        key === "" ||
        key.includes(".") ||
        ["__proto__", "prototype", "constructor"].includes(key)
      ) {
        errors.push(
          `${currentPath ? `${currentPath}.` : ""}${key}: invalid path segment`,
        );
        continue;
      }
      validateNode(value, currentPath ? `${currentPath}.${key}` : key);
    }
  }

  validateNode(document, "");

  for (const theme of getThemeEntries(document)) {
    if (!isObject(theme)) {
      errors.push("root.$themes: invalid theme entry");
      continue;
    }
    if (!theme.id || typeof theme.id !== "string") {
      errors.push("root.$themes: theme is missing string id");
    }
    const selectedSets = Object.entries(theme.selectedTokenSets ?? {})
      .filter(([, state]) => state !== "disabled")
      .map(([setName]) => setName);

    if (selectedSets.length === 0) {
      errors.push(`${theme.id ?? "unknown-theme"}: no enabled token sets`);
    }

    for (const setName of selectedSets) {
      if (!tokenSets.has(setName)) {
        errors.push(
          `${theme.id ?? "unknown-theme"}: missing token set ${setName}`,
        );
      }
    }

    const flattened = flattenTokens(document, selectedSets);
    for (const [tokenPath, leaf] of flattened) {
      try {
        resolveAlias(getLeafValue(leaf), flattened);
      } catch (error) {
        errors.push(
          `${String(theme.id)}:${tokenPath}: ${formatAliasError(
            error,
            allTokens,
            selectedSets,
          )}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`${sourceName} failed validation:\n${errors.join("\n")}`);
  }
}

export function renderTemplate(
  template: string,
  props: Record<string, unknown>,
  slots: Record<string, string> = {},
): string {
  let rendered = template;
  for (const [slotName, value] of Object.entries(slots)) {
    rendered = rendered.replaceAll(`{{{ slots.${slotName} }}}`, value);
  }
  for (const [key, value] of Object.entries(props)) {
    rendered = rendered.replaceAll(`{{ ${key} }}`, escapeHtml(String(value)));
  }
  return rendered;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? value : null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getThemeEntries(document: TokenDocument): TokensStudioTheme[] {
  return Array.isArray(document.$themes)
    ? (document.$themes as TokensStudioTheme[])
    : [];
}

export function compactObject<T extends Record<string, unknown>>(
  object: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function formatAliasError(
  error: unknown,
  allTokens: Map<string, TokenLeaf>,
  selectedSets: string[],
): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^Unresolved alias: (.+)$/);
  if (!match) return message;

  const aliasPath = match[1]!;
  const target = allTokens.get(aliasPath);
  if (!target) return message;

  const targetSet = aliasPath.split(".")[0];
  const activeSets = selectedSets.length > 0 ? selectedSets.join(", ") : "none";
  return `${message}; ${targetSet} exists but is not active for this theme (active sets: ${activeSets})`;
}
