import assert from "node:assert/strict";
import test from "node:test";
import {
  getColorSchemeRootSegments,
  getReferenceRootSegments,
  getThemesFromTokenDocument,
  groupThemesByParent,
} from "../scripts/lib/themes.js";
import {
  getThemeArtifactPaths,
  getThemeGroupCssPaths,
} from "../scripts/lib/artifact-output.js";
import type {
  BuildTheme,
  TokenDocument,
  TokenProject,
} from "../scripts/lib/types.js";

const project: TokenProject = {
  id: "websites",
  tokenFile: "tokens.json",
  outputDir: "dist/websites",
  themeFolders: true,
};

const tokens: TokenDocument = {
  global: { color: { white: { value: "#fff", type: "color" } } },
  "health-white": {
    color: { surface: { value: "{global.color.white}", type: "color" } },
  },
  "health-black": {
    color: { surface: { value: "#000", type: "color" } },
  },
  "cx-reference": { spacing: { small: { value: "4px", type: "spacing" } } },
  "cx-white": {
    color: { surface: { value: "#fafafa", type: "color" } },
  },
  "cx-black": {
    color: { surface: { value: "#111", type: "color" } },
  },
  $themes: [
    {
      id: "health-theme",
      name: "Health",
      selectedTokenSets: {
        global: "source",
        "health-white": "enabled",
        "health-black": "enabled",
      },
      $extensions: {
        ekinoTokenArchitect: {
          modeSets: ["health-white", "health-black"],
        },
      },
    },
    {
      id: "cx-theme",
      name: "CX",
      selectedTokenSets: {
        "cx-reference": "source",
        "cx-white": "enabled",
        "cx-black": "enabled",
      },
      $extensions: {
        ekinoTokenArchitect: { modeSets: ["cx-white", "cx-black"] },
      },
    },
  ],
};

test("groups expanded modes by their parent theme", () => {
  const groups = groupThemesByParent(
    getThemesFromTokenDocument(project, tokens),
  );

  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      outputs: group.themes.map((theme) => theme.outputId),
    })),
    [
      { id: "health", outputs: ["health-white", "health-black"] },
      { id: "cx", outputs: ["cx-white", "cx-black"] },
    ],
  );
});

test("dedupes duplicate generated theme ids when effective token sets match", () => {
  const dedupedTokens: TokenDocument = {
    global: { color: { white: { value: "#fff", type: "color" } } },
    light: { color: { surface: { value: "#fff", type: "color" } } },
    dark: { color: { surface: { value: "#000", type: "color" } } },
    alternate: { color: { surface: { value: "#111", type: "color" } } },
    $themes: [
      {
        id: "first",
        name: "First",
        selectedTokenSets: {
          global: "source",
          light: "enabled",
          dark: "enabled",
        },
        $extensions: {
          ekinoTokenArchitect: { modeSets: ["light", "dark"] },
        },
      },
      {
        id: "second",
        name: "Second",
        selectedTokenSets: {
          global: "source",
          alternate: "enabled",
          dark: "enabled",
        },
        $extensions: {
          ekinoTokenArchitect: { modeSets: ["alternate", "dark"] },
        },
      },
    ],
  };

  assert.deepEqual(
    getThemesFromTokenDocument(
      { ...project, id: "dedupe", themeFolders: false },
      dedupedTokens,
    ).map((theme) => theme.outputId),
    ["light", "dark", "alternate"],
  );
});

test("promotes sets marked source anywhere to shared references in flat output", () => {
  const mixedStateTokens: TokenDocument = {
    global: { color: { base: { value: "#fff", type: "color" } } },
    test: { color: { surface: { value: "#eee", type: "color" } } },
    cx: { color: { surface: { value: "#111", type: "color" } } },
    $themes: [
      {
        id: "test-theme",
        name: "Test",
        selectedTokenSets: {
          global: "enabled",
          test: "enabled",
        },
        $extensions: {
          ekinoTokenArchitect: { modeSets: ["global", "test"] },
        },
      },
      {
        id: "cx-theme",
        name: "CX",
        selectedTokenSets: {
          global: "source",
          cx: "enabled",
        },
        $extensions: {
          ekinoTokenArchitect: { modeSets: ["cx"] },
        },
      },
    ],
  };

  assert.deepEqual(
    getThemesFromTokenDocument(
      { ...project, id: "flat", themeFolders: false },
      mixedStateTokens,
    ).map((theme) => ({
      outputId: theme.outputId,
      sets: theme.sets,
      sourceSets: theme.sourceSets,
    })),
    [
      { outputId: "test", sets: ["global", "test"], sourceSets: ["global"] },
      { outputId: "cx", sets: ["global", "cx"], sourceSets: ["global"] },
    ],
  );
});

test("rejects duplicate generated theme ids when effective token sets differ", () => {
  const conflictingTokens: TokenDocument = {
    global: { color: { white: { value: "#fff", type: "color" } } },
    other: { spacing: { small: { value: "4px", type: "spacing" } } },
    dark: { color: { surface: { value: "#000", type: "color" } } },
    $themes: [
      {
        id: "first",
        name: "Dark",
        selectedTokenSets: {
          global: "source",
          dark: "enabled",
        },
      },
      {
        id: "second",
        name: "Dark",
        selectedTokenSets: {
          global: "source",
          other: "source",
          dark: "enabled",
        },
      },
    ],
  };

  assert.throws(
    () =>
      getThemesFromTokenDocument(
        { ...project, id: "dedupe", themeFolders: false },
        conflictingTokens,
      ),
    /multiple themes that produce generated theme id dark/,
  );
});

test("computes source and reference roots within each parent theme", () => {
  const groups = groupThemesByParent(
    getThemesFromTokenDocument(project, tokens),
  );
  const health = groups.find((group) => group.id === "health")!;
  const cx = groups.find((group) => group.id === "cx")!;

  const healthSchemes = getColorSchemeRootSegments(health.themes);
  const cxSchemes = getColorSchemeRootSegments(cx.themes);

  assert.deepEqual([...healthSchemes], ["health-white", "health-black"]);
  assert.deepEqual(
    [...getReferenceRootSegments(health.themes, healthSchemes)],
    ["global"],
  );
  assert.deepEqual([...cxSchemes], ["cx-white", "cx-black"]);
  assert.deepEqual(
    [...getReferenceRootSegments(cx.themes, cxSchemes)],
    ["cx-reference"],
  );
});

test("uses theme folders without changing the existing flat path contract", () => {
  const theme: BuildTheme = {
    id: "health-theme:health-white",
    name: "health-white",
    sets: ["global", "health-white"],
    sourceSets: ["global"],
    outputId: "health-white",
    groupId: "health",
    groupName: "Health",
  };

  assert.deepEqual(getThemeArtifactPaths(project, theme), {
    css: "css/health/health-white.css",
    resolvedTokens: "json/health/health-white.resolved-tokens.json",
    metadata: "json/health/health-white.metadata.json",
    manifestKey: "health/health-white",
  });
  assert.deepEqual(getThemeGroupCssPaths(project, "health"), {
    css: "css/health/token.css",
    referenceCss: "css/health/reference.css",
  });

  const flatProject = { ...project, themeFolders: false };
  assert.deepEqual(getThemeArtifactPaths(flatProject, theme), {
    css: "css/websites.health-white.tokens.css",
    resolvedTokens: "json/websites.health-white.resolved-tokens.json",
    metadata: "json/websites.health-white.metadata.json",
    manifestKey: "health-white",
  });
  assert.deepEqual(getThemeGroupCssPaths(flatProject, "health"), {
    css: "css/websites.tokens.css",
    referenceCss: "css/websites.reference.css",
  });
});
