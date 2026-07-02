import type { BuildTheme, TokenDocument, TokenProject } from "./types.js";
import { expandEffectiveThemeSetGroups, isObject } from "./token-utils.js";

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
  themes: Pick<BuildTheme, "sets" | "sourceSets">[],
): Set<string> {
  const themeCount = themes.length;
  const countBySet = new Map<string, number>();
  const sourceRootSegments = getSourceRootSegments(themes);

  for (const theme of themes) {
    for (const setName of new Set(
      theme.sets
        .map((set) => kebabSegment(set))
        .filter((segment) => !sourceRootSegments.has(segment)),
    )) {
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
  themes: Pick<BuildTheme, "sets" | "sourceSets">[],
  colorSchemeRootSegments: Set<string>,
): Set<string> {
  const rootSegments = new Set<string>();
  const sourceRootSegments = getSourceRootSegments(themes);

  for (const theme of themes) {
    for (const setName of theme.sets) {
      const segment = kebabSegment(setName);
      if (
        sourceRootSegments.has(segment) ||
        !colorSchemeRootSegments.has(segment)
      ) {
        rootSegments.add(segment);
      }
    }
  }

  return rootSegments;
}

function getSourceRootSegments(
  themes: Pick<BuildTheme, "sourceSets">[],
): Set<string> {
  return new Set(
    themes.flatMap((theme) =>
      (theme.sourceSets ?? []).map((setName) => kebabSegment(setName)),
    ),
  );
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
    const sourceSets = Object.entries(selectedTokenSets)
      .filter(([, state]) => state === "source")
      .map(([setName]) => setName);
    const enabledSets = Object.entries(selectedTokenSets)
      .filter(([, state]) => state === "enabled")
      .map(([setName]) => setName);
    const sets = [...sourceSets, ...enabledSets];

    if (sets.length === 0) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} has no active token sets.`,
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
          sourceSets,
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
  return expandEffectiveThemeSetGroups(theme, tokens);
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
