import fs from "node:fs";
import path from "node:path";
import type {
  ProjectsConfig,
  TargetConfig,
  TargetsConfig,
  TokenDocument,
  TokenLeaf,
  TokenNode,
  TokenTheme,
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
  return isObject(value) && ("value" in value || "type" in value);
}

export function getLeafValue(leaf: TokenLeaf): unknown {
  return leaf.value;
}

export function getLeafType(leaf: TokenLeaf): unknown {
  return leaf.type;
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
  if (typeof value === "string") {
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

  if (Array.isArray(value)) {
    return value.map((item) => resolveAlias(item, tokens, chain));
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        resolveAlias(child, tokens, chain),
      ]),
    );
  }

  return value;
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
    const selectedTokenSets = isObject(theme.selectedTokenSets)
      ? theme.selectedTokenSets
      : null;

    if (!selectedTokenSets) {
      errors.push(
        `${String(theme.id ?? "unknown-theme")}: selectedTokenSets must be an object`,
      );
    }

    const selectedSetEntries = Object.entries(selectedTokenSets ?? {}).filter(
      ([setName, state]) => {
        if (!isTokenSetState(state)) {
          errors.push(
            `${String(theme.id ?? "unknown-theme")}.${setName}: invalid selectedTokenSets state ${String(state)}`,
          );
          return false;
        }
        return state !== "disabled";
      },
    );
    const sourceSets = selectedSetEntries
      .filter(([, state]) => state === "source")
      .map(([setName]) => setName);
    const enabledSets = selectedSetEntries
      .filter(([, state]) => state === "enabled")
      .map(([setName]) => setName);
    const selectedSets = [...sourceSets, ...enabledSets];

    if (enabledSets.length === 0) {
      errors.push(
        `${theme.id ?? "unknown-theme"}: must include at least one enabled token set`,
      );
    }

    if (selectedSets.length === 0) {
      errors.push(`${theme.id ?? "unknown-theme"}: no active token sets`);
    }

    for (const setName of selectedSets) {
      if (!tokenSets.has(setName)) {
        errors.push(
          `${theme.id ?? "unknown-theme"}: missing token set ${setName}`,
        );
      }
    }

    const themeId = String(theme.id ?? "unknown-theme");
    const themeName =
      typeof theme.name === "string" && theme.name.trim()
        ? theme.name
        : themeId;
    const effectiveThemes = expandEffectiveThemeSetGroups(
      {
        id: themeId,
        name: themeName,
        sets: selectedSets,
        sourceSets,
        modeSets: getExplicitModeSetsForValidation(theme, enabledSets, errors),
      },
      document,
    );

    for (const effectiveTheme of effectiveThemes) {
      const flattened = flattenTokens(document, effectiveTheme.sets);
      for (const [tokenPath, leaf] of flattened) {
        try {
          resolveAlias(getLeafValue(leaf), flattened);
        } catch (error) {
          errors.push(
            `${effectiveTheme.id}:${tokenPath}: ${formatAliasError(
              error,
              allTokens,
              effectiveTheme.sets,
            )}`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`${sourceName} failed validation:\n${errors.join("\n")}`);
  }
}

function isTokenSetState(
  value: unknown,
): value is "enabled" | "disabled" | "source" {
  return value === "enabled" || value === "disabled" || value === "source";
}

export interface EffectiveThemeSetGroup {
  id: string;
  name: string;
  sets: string[];
  sourceSets?: string[];
  modeSets?: string[];
}

export function expandEffectiveThemeSetGroups(
  theme: EffectiveThemeSetGroup,
  tokens: TokenDocument,
): EffectiveThemeSetGroup[] {
  const sourceSetNames = new Set(theme.sourceSets ?? []);
  const modeCandidateSets = theme.sets.filter(
    (setName) => !sourceSetNames.has(setName),
  );
  const modeSets =
    theme.modeSets ??
    getThemeModeSets({ name: theme.name, sets: modeCandidateSets }, tokens);
  if (
    theme.modeSets === undefined &&
    modeCandidateSets.length > 1 &&
    modeSets.length <= 1
  ) {
    console.warn(
      `Theme ${theme.name} has multiple enabled token sets but no explicit modeSets metadata and automatic mode expansion did not find sibling modes.`,
    );
  }
  if (modeSets.length <= 1) return [theme];

  const modeSetNames = new Set(modeSets);
  const baseSets = theme.sets.filter((setName) => !modeSetNames.has(setName));

  return modeSets.map((setName) => ({
    id: `${theme.id}:${setName}`,
    name: setName,
    sets: [...baseSets, setName],
    sourceSets: theme.sourceSets,
  }));
}

function getThemeModeSets(
  theme: Pick<EffectiveThemeSetGroup, "name" | "sets">,
  tokens: TokenDocument,
): string[] {
  const duplicateSets = new Set<string>();
  const ownersByLocalPath = new Map<string, string[]>();
  const themePrefix = kebabSegmentForExpansion(theme.name);

  for (const setName of theme.sets) {
    const set = tokens[setName];
    if (!isObject(set)) continue;

    for (const localPath of getTokenLocalPaths(set)) {
      const owners = ownersByLocalPath.get(localPath) ?? [];
      owners.push(setName);
      ownersByLocalPath.set(localPath, owners);
    }
  }

  for (const owners of ownersByLocalPath.values()) {
    if (owners.length <= 1) continue;
    for (const setName of owners) {
      duplicateSets.add(setName);
    }
  }

  const modeSets = theme.sets.filter((setName) => {
    const segment = kebabSegmentForExpansion(setName);
    return (
      duplicateSets.has(setName) &&
      (segment === themePrefix || segment.startsWith(`${themePrefix}-`))
    );
  });

  return modeSets.length === duplicateSets.size ? modeSets : [];
}

function getTokenLocalPaths(node: unknown): string[] {
  const paths: string[] = [];

  function walk(value: unknown, prefix: string): void {
    if (isTokenLeaf(value)) {
      paths.push(prefix);
      return;
    }
    if (!isObject(value)) return;

    for (const [key, child] of Object.entries(value)) {
      walk(child, prefix ? `${prefix}.${key}` : key);
    }
  }

  walk(node, "");
  return paths;
}

function kebabSegmentForExpansion(value: unknown): string {
  return String(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getExplicitModeSetsForValidation(
  theme: TokenTheme,
  enabledSets: string[],
  errors: string[],
): string[] | undefined {
  const extension = isObject(theme.$extensions) ? theme.$extensions : null;
  const architect = isObject(extension?.ekinoTokenArchitect)
    ? extension.ekinoTokenArchitect
    : null;
  const modeSets = architect?.modeSets;
  if (modeSets === undefined) return undefined;

  const themeId = String(theme.id ?? "unknown-theme");
  if (!Array.isArray(modeSets)) {
    errors.push(
      `${themeId}: $extensions.ekinoTokenArchitect.modeSets must be an array`,
    );
    return undefined;
  }

  const enabledSetNames = new Set(enabledSets);
  const validModeSets: string[] = [];
  for (const setName of modeSets) {
    if (typeof setName !== "string") {
      errors.push(`${themeId}: modeSets entries must be strings`);
      continue;
    }
    if (!enabledSetNames.has(setName)) {
      errors.push(`${themeId}: mode set ${setName} is not enabled`);
      continue;
    }
    validModeSets.push(setName);
  }

  return validModeSets;
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

export function getThemeEntries(document: TokenDocument): TokenTheme[] {
  return Array.isArray(document.$themes)
    ? (document.$themes as TokenTheme[])
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
