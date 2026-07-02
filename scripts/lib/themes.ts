import type { BuildTheme, TokenDocument, TokenProject } from "./types.js";
import { isObject, isTokenLeaf } from "./token-utils.js";

export function selectThemeTokens(
  tokens: TokenDocument,
  selectedSets: string[] = [],
): TokenDocument {
  return Object.fromEntries(
    selectedSets
      .filter((setName) => tokens[setName])
      .map((setName) => [setName, tokens[setName]]),
  );
}

export function getColorSchemeRootSegments(
  themes: Pick<BuildTheme, "sets">[],
): Set<string> {
  const themeCount = themes.length;
  const countBySet = new Map<string, number>();

  for (const theme of themes) {
    for (const setName of new Set(theme.sets.map((set) => kebabSegment(set)))) {
      countBySet.set(setName, (countBySet.get(setName) ?? 0) + 1);
    }
  }

  return new Set(
    [...countBySet.entries()]
      .filter(([, count]) => count < themeCount)
      .map(([setName]) => setName),
  );
}

export function getReferenceRootSegments(
  themes: Pick<BuildTheme, "sets">[],
  colorSchemeRootSegments: Set<string>,
): Set<string> {
  const rootSegments = new Set<string>();

  for (const theme of themes) {
    for (const setName of theme.sets) {
      const segment = kebabSegment(setName);
      if (!colorSchemeRootSegments.has(segment)) {
        rootSegments.add(segment);
      }
    }
  }

  return rootSegments;
}

export function getThemesFromTokenDocument(
  project: TokenProject,
  tokens: TokenDocument,
): BuildTheme[] {
  if (!Array.isArray(tokens.$themes) || tokens.$themes.length === 0) {
    throw new Error(
      `${project.tokenFile} must include a non-empty $themes array.`,
    );
  }

  const outputIds = new Set<string>();
  const themes: Omit<BuildTheme, "outputId">[] = [];

  for (const theme of tokens.$themes) {
    if (!isObject(theme)) {
      throw new Error(`${project.tokenFile} has an invalid theme entry.`);
    }
    if (!theme.id || typeof theme.id !== "string") {
      throw new Error(`${project.tokenFile} has a theme without a string id.`);
    }

    const selectedTokenSets = isObject(theme.selectedTokenSets)
      ? theme.selectedTokenSets
      : {};
    const sets = Object.entries(selectedTokenSets)
      .filter(([, state]) => state !== "disabled")
      .map(([setName]) => setName);

    if (sets.length === 0) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} has no enabled token sets.`,
      );
    }

    themes.push(
      ...expandThemeModeSets(
        {
          id: theme.id,
          name:
            typeof theme.name === "string" && theme.name.trim()
              ? theme.name
              : theme.id,
          sets,
        },
        tokens,
      ),
    );
  }

  return themes.map((theme) => {
    const outputName = theme.name;
    const outputId =
      themeOutputSegment(project.id, outputName) ||
      themeOutputSegment(project.id, theme.id);
    if (!outputId) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} does not produce a valid kebab-case theme output name.`,
      );
    }
    if (outputIds.has(outputId)) {
      throw new Error(
        `${project.tokenFile} has multiple themes that produce generated theme id ${outputId}.`,
      );
    }
    outputIds.add(outputId);

    return {
      ...theme,
      outputId,
    };
  });
}

export function expandThemeModeSets(
  theme: Omit<BuildTheme, "outputId">,
  tokens: TokenDocument,
): Omit<BuildTheme, "outputId">[] {
  const modeSets = getThemeModeSets(theme, tokens);
  if (modeSets.length <= 1) return [theme];

  const modeSetNames = new Set(modeSets);
  const baseSets = theme.sets.filter((setName) => !modeSetNames.has(setName));

  return modeSets.map((setName) => ({
    id: `${theme.id}:${setName}`,
    name: setName,
    sets: [...baseSets, setName],
  }));
}

export function kebabSegment(value: unknown): string {
  return String(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function themeOutputSegment(projectId: string, themeId: string): string {
  const projectSegment = kebabSegment(projectId);
  const themeSegment = kebabSegment(themeId);

  return themeSegment.startsWith(`${projectSegment}-`)
    ? themeSegment.slice(projectSegment.length + 1)
    : themeSegment;
}

function getThemeModeSets(
  theme: Pick<BuildTheme, "name" | "sets">,
  tokens: TokenDocument,
): string[] {
  const duplicateSets = new Set<string>();
  const ownersByLocalPath = new Map<string, string[]>();
  const themePrefix = kebabSegment(theme.name);

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
    const segment = kebabSegment(setName);
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
