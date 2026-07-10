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

  // A non-source set that appears in fewer than all generated effective themes
  // is a scheme root. Sets present in every effective theme are shared reference
  // roots, so their root segment stays in generated CSS variable names.
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

  const outputSignatures = new Map<string, string>();
  const themes: Omit<BuildTheme, "outputId">[] = [];
  const flatSourceSetNames = project.themeFolders
    ? new Set<string>()
    : getProjectSourceSetNames(tokens.$themes);

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
    const rawSourceSets = Object.entries(selectedTokenSets)
      .filter(([, state]) => state === "source")
      .map(([setName]) => setName);
    const rawEnabledSets = Object.entries(selectedTokenSets)
      .filter(([, state]) => state === "enabled")
      .map(([setName]) => setName);
    const sourceSets = [
      ...rawSourceSets,
      ...rawEnabledSets.filter((setName) => flatSourceSetNames.has(setName)),
    ];
    const enabledSets = rawEnabledSets.filter(
      (setName) => !flatSourceSetNames.has(setName),
    );
    const sets = [...sourceSets, ...enabledSets];

    if (rawEnabledSets.length === 0) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} must include at least one enabled token set.`,
      );
    }

    if (sets.length === 0) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} has no active token sets.`,
      );
    }
    const modeSets = getExplicitModeSets(theme, rawEnabledSets)?.filter(
      (setName) => !flatSourceSetNames.has(setName),
    );
    if (enabledSets.length === 0) {
      continue;
    }

    const groupId =
      themeOutputSegment(project.id, String(theme.name ?? theme.id)) ||
      themeOutputSegment(project.id, theme.id);
    if (!groupId) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} does not produce a valid theme folder name.`,
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
          modeSets,
          groupId,
          groupName:
            typeof theme.name === "string" && theme.name.trim()
              ? theme.name
              : theme.id,
        },
        tokens,
      ),
    );
  }

  return themes.flatMap((theme) => {
    const outputName = theme.name;
    const outputId =
      themeOutputSegment(project.id, outputName) ||
      themeOutputSegment(project.id, theme.id);
    if (!outputId) {
      throw new Error(
        `${project.tokenFile} theme ${theme.id} does not produce a valid kebab-case theme output name.`,
      );
    }
    const outputKey = project.themeFolders
      ? `${theme.groupId}/${outputId}`
      : outputId;
    const outputSignature = getThemeOutputSignature(theme);
    const existingSignature = outputSignatures.get(outputKey);
    if (existingSignature === outputSignature) return [];
    if (existingSignature) {
      throw new Error(
        `${project.tokenFile} has multiple themes that produce generated theme id ${outputId}.`,
      );
    }
    outputSignatures.set(outputKey, outputSignature);

    return [
      {
        ...theme,
        outputId,
      },
    ];
  });
}

function getProjectSourceSetNames(themes: unknown[]): Set<string> {
  const sourceSetNames = new Set<string>();
  for (const theme of themes) {
    if (!isObject(theme)) continue;
    const selectedTokenSets = isObject(theme.selectedTokenSets)
      ? theme.selectedTokenSets
      : {};
    for (const [setName, state] of Object.entries(selectedTokenSets)) {
      if (state === "source") sourceSetNames.add(setName);
    }
  }
  return sourceSetNames;
}

function getThemeOutputSignature(theme: Omit<BuildTheme, "outputId">): string {
  return JSON.stringify({
    sets: theme.sets,
    sourceSets: theme.sourceSets ?? [],
  });
}

export function expandThemeModeSets(
  theme: Omit<BuildTheme, "outputId">,
  tokens: TokenDocument,
): Omit<BuildTheme, "outputId">[] {
  return expandEffectiveThemeSetGroups(theme, tokens);
}

export function groupThemesByParent(
  themes: BuildTheme[],
): Array<{ id: string; name: string; themes: BuildTheme[] }> {
  const groups = new Map<
    string,
    { id: string; name: string; themes: BuildTheme[] }
  >();

  for (const theme of themes) {
    const group = groups.get(theme.groupId) ?? {
      id: theme.groupId,
      name: theme.groupName,
      themes: [],
    };
    group.themes.push(theme);
    groups.set(theme.groupId, group);
  }

  return [...groups.values()];
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

function getExplicitModeSets(
  theme: Record<string, unknown>,
  enabledSets: string[],
): string[] | undefined {
  const extension = theme.$extensions;
  if (!isObject(extension)) return undefined;
  const architect = extension.ekinoTokenArchitect;
  if (!isObject(architect)) return undefined;
  const modeSets = architect.modeSets;
  if (modeSets === undefined) return undefined;
  if (!Array.isArray(modeSets)) {
    throw new Error(
      `Theme ${String(theme.id ?? "unknown-theme")} has invalid $extensions.ekinoTokenArchitect.modeSets; expected an array of enabled token set names.`,
    );
  }

  const enabledSetNames = new Set(enabledSets);
  return modeSets.map((setName) => {
    if (typeof setName !== "string" || !enabledSetNames.has(setName)) {
      throw new Error(
        `Theme ${String(theme.id ?? "unknown-theme")} has mode set ${String(setName)} that is not selected as enabled.`,
      );
    }
    return setName;
  });
}
