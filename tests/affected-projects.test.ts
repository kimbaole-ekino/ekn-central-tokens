import assert from "node:assert/strict";
import test from "node:test";
import {
  detectAffectedProjects,
  fallbackAffectedProjects,
} from "../scripts/lib/affected-projects.js";
import type { TokenProject } from "../scripts/lib/types.js";

const project = (id: string): TokenProject => ({
  id,
  tokenFile: `token-definitions/projects/${id}/tokens.json`,
  outputDir: `dist/${id}`,
  packageName: `@ekinotech/design-tokens-${id}`,
  version: "0.1.0",
  documentationSlug: id,
  enabled: true,
});
const a = project("a");
const b = project("b");
test("one or several direct token changes select only those projects", () => {
  assert.deepEqual(
    detectAffectedProjects(
      ["token-definitions/projects/a/tokens.json"],
      [a, b],
      [a, b],
      ["a", "b"],
    ).affected,
    ["a"],
  );
  assert.deepEqual(
    detectAffectedProjects(
      [
        "token-definitions/projects/a/tokens.json",
        "token-definitions/projects/b/tokens.json",
      ],
      [a, b],
      [a, b],
      ["a", "b"],
    ).affected,
    ["a", "b"],
  );
});
test("shared build and Storybook changes select all projects", () => {
  assert.deepEqual(
    detectAffectedProjects(
      ["scripts/lib/style-dictionary.ts"],
      [a, b],
      [a, b],
      ["a", "b"],
    ).affected,
    ["a", "b"],
  );
  assert.deepEqual(
    detectAffectedProjects(
      ["storybook/token-guide.css"],
      [a, b],
      [a, b],
      ["a", "b"],
    ).affected,
    ["a", "b"],
  );
});
test("project add, removal, and configuration changes are deterministic", () => {
  assert.deepEqual(
    detectAffectedProjects(["projects.config.json"], [a], [a, b], ["a", "b"])
      .affected,
    ["b"],
  );
  assert.deepEqual(
    detectAffectedProjects(["projects.config.json"], [a, b], [a], ["a"])
      .affected,
    [],
  );
  assert.deepEqual(
    detectAffectedProjects(
      ["projects.config.json"],
      [a, b],
      [{ ...a, outputDir: "dist/a-preview" }, b],
      ["a", "b"],
    ).affected,
    ["a"],
  );
});
test("irrelevant changes select no projects", () => {
  assert.deepEqual(
    detectAffectedProjects(["README.md"], [a, b], [a, b], ["a", "b"]),
    { affected: [], validation: [] },
  );
});
test("a missing base commit falls back to every current and discovered project", () => {
  assert.deepEqual(fallbackAffectedProjects([a, b], ["b", "unregistered"]), {
    affected: ["a", "b"],
    validation: ["a", "b", "unregistered"],
  });
});
test("disabled projects are not built or validated", () => {
  const disabled = {
    ...b,
    enabled: false,
    disabledReason: "Canonical tokens are not ready.",
  };
  assert.deepEqual(
    detectAffectedProjects(
      ["token-definitions/projects/b/tokens.json"],
      [a, disabled],
      [a, disabled],
      ["a", "b"],
    ),
    { affected: [], validation: [] },
  );
  assert.deepEqual(fallbackAffectedProjects([a, disabled], ["a"]), {
    affected: ["a"],
    validation: ["a"],
  });
});
