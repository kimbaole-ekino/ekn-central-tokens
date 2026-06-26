import fs from "node:fs";
import path from "node:path";

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function getProjectsConfig(rootDir) {
  return readJson(path.join(rootDir, "projects.config.json"));
}

export function getTargetsConfig(rootDir) {
  return readJson(path.join(rootDir, "targets.config.json"));
}

export function getTokenSetNames(document) {
  const actual = Object.keys(document).filter((key) => !key.startsWith("$"));
  const order = Array.isArray(document.$metadata?.tokenSetOrder)
    ? document.$metadata.tokenSetOrder.filter((name) => actual.includes(name))
    : [];
  return [...order, ...actual.filter((name) => !order.includes(name))];
}

export function flattenTokens(
  document,
  selectedSets = getTokenSetNames(document),
) {
  const output = new Map();

  function walk(node, prefix) {
    for (const [key, value] of Object.entries(node)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (isTokenLeaf(value)) {
        output.set(currentPath, value);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, currentPath);
      }
    }
  }

  for (const setName of selectedSets) {
    const set = document[setName];
    if (set && typeof set === "object" && !Array.isArray(set)) {
      walk(set, setName);
    }
  }

  return output;
}

export function isTokenLeaf(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("value" in value ||
      "type" in value ||
      "$value" in value ||
      "$type" in value)
  );
}

export function getLeafValue(leaf) {
  return "value" in leaf ? leaf.value : leaf.$value;
}

export function getLeafType(leaf) {
  return "type" in leaf ? leaf.type : leaf.$type;
}

export function cssVariableName(tokenPath) {
  return `--${tokenPath
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}`;
}

export function resolveAlias(value, tokens, chain = []) {
  if (typeof value !== "string") return value;
  const match = value.match(/^\{([^{}]+)\}$/);
  if (!match) return value;
  const path = match[1];
  if (chain.includes(path)) {
    throw new Error(`Cyclic alias: ${[...chain, path].join(" -> ")}`);
  }
  const target = tokens.get(path);
  if (!target) {
    throw new Error(`Unresolved alias: ${path}`);
  }
  return resolveAlias(getLeafValue(target), tokens, [...chain, path]);
}

export function validateTokenDocument(document, sourceName) {
  const errors = [];
  const stableIds = new Map();
  const tokenSets = new Set(getTokenSetNames(document));

  if (!Array.isArray(document.$themes) || document.$themes.length === 0) {
    errors.push("root: missing non-empty $themes array");
  }

  function validateNode(node, currentPath) {
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

    if (!node || typeof node !== "object" || Array.isArray(node)) {
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

  for (const theme of document.$themes ?? []) {
    if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
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
        errors.push(`${theme.id}:${tokenPath}: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`${sourceName} failed validation:\n${errors.join("\n")}`);
  }
}

export function renderTemplate(template, props, slots = {}) {
  let rendered = template;
  for (const [slotName, value] of Object.entries(slots)) {
    rendered = rendered.replaceAll(`{{{ slots.${slotName} }}}`, value);
  }
  for (const [key, value] of Object.entries(props)) {
    rendered = rendered.replaceAll(`{{ ${key} }}`, escapeHtml(String(value)));
  }
  return rendered;
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
