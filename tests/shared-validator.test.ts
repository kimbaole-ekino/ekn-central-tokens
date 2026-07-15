import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveActiveThemeContext,
  resolveEffectiveTokens,
  validateTokenDocument as validateShared,
} from "@eknvn/token-validator";
import { validateTokenDocument } from "../scripts/lib/token-utils.js";
import { permutateThemes } from "@tokens-studio/sd-transforms";
import { TokenSetStatus } from "@tokens-studio/types";
import type { TokenDocument } from "../scripts/lib/types.js";

function validDocument(): TokenDocument {
  return {
    primitives: { color: { base: { type: "color", value: "#0055ff" } } },
    semantic: { color: { primary: { type: "color", value: "{color.base}" } } },
    "mode/dark": { color: { primary: { type: "color", value: "#111111" } } },
    $themes: [
      {
        id: "brand",
        name: "Brand",
        group: "Brand",
        selectedTokenSets: { primitives: "source", semantic: "enabled" },
      },
      {
        id: "dark",
        name: "Dark",
        group: "Color mode",
        selectedTokenSets: { "mode/dark": "enabled" },
      },
    ],
    $metadata: { tokenSetOrder: ["primitives", "semantic", "mode/dark"] },
  };
}

test("central imports and enforces the shared submission contract", () => {
  assert.doesNotThrow(() => validateTokenDocument(validDocument(), "fixture"));
  const invalid = validDocument();
  (invalid.semantic as Record<string, unknown>).broken = {
    type: "color",
    value: "{missing.token}",
  };
  assert.equal(
    validateShared(invalid, { profile: "submission" }).diagnostics.some(
      (item) => item.code === "REFERENCE_BROKEN",
    ),
    true,
  );
  assert.throws(
    () => validateTokenDocument(invalid, "fixture"),
    /REFERENCE_BROKEN/,
  );
});

test("central effective values are exactly the shared package graph", () => {
  const document = validDocument();
  const context = resolveActiveThemeContext(document, {
    Brand: "brand",
    "Color mode": "dark",
  });
  const graph = resolveEffectiveTokens(document, context);
  assert.equal(graph.tokens.get("color.primary")?.resolvedValue, "#111111");
  assert.equal(graph.tokens.get("color.primary")?.winningSet, "mode/dark");
});

test("shared submission allows Set-only documents but rejects bad booleans and set-prefixed aliases", () => {
  const missingThemes = validDocument();
  delete missingThemes.$themes;
  assert.doesNotThrow(() => validateTokenDocument(missingThemes, "fixture"));
  const badBoolean = validDocument();
  (badBoolean.semantic as Record<string, unknown>).enabled = {
    type: "boolean",
    value: "true",
  };
  assert.throws(
    () => validateTokenDocument(badBoolean, "fixture"),
    /TOKEN_VALUE_INVALID/,
  );
  const prefixed = validDocument();
  (prefixed.semantic as Record<string, unknown>).bad = {
    type: "color",
    value: "{primitives.color.base}",
  };
  assert.throws(
    () => validateTokenDocument(prefixed, "fixture"),
    /REFERENCE_BROKEN/,
  );
});

test("conflicting cross-group statuses conform to sd-transforms permutations", () => {
  const themes = [
    {
      id: "a",
      name: "A",
      group: "G1",
      selectedTokenSets: {
        x: TokenSetStatus.DISABLED,
        y: TokenSetStatus.SOURCE,
        z: TokenSetStatus.DISABLED,
      },
    },
    {
      id: "b",
      name: "B",
      group: "G2",
      selectedTokenSets: {
        x: TokenSetStatus.ENABLED,
        y: TokenSetStatus.DISABLED,
        z: TokenSetStatus.SOURCE,
      },
    },
  ];
  const document = {
    x: {},
    y: {},
    z: {},
    $themes: themes,
    $metadata: { tokenSetOrder: ["y", "z", "x"] },
  };
  const context = resolveActiveThemeContext(document, { G1: "a", G2: "b" });
  const activeSets = [
    ...context.orderedSourceSetNames,
    ...context.orderedEnabledSetNames,
  ];
  assert.deepEqual(activeSets, Object.values(permutateThemes(themes))[0]);
});
