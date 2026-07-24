import { guide } from "./generated-guide.mjs";
import type { GuideToken, TokenSection } from "./guide-types.js";

interface HtmlStory {
  render: () => string;
}

const escape = (input: unknown): string =>
  String(input ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

const value = (input: unknown): string =>
  typeof input === "object" ? JSON.stringify(input) : String(input ?? "—");

const shell = (title: string, body: string, intro = ""): string =>
  `<main class="guide"><header><p class="eyebrow">${escape(guide.projectId)} · v${escape(guide.version)}</p><h1>${escape(title)}</h1>${intro ? `<p class="intro">${escape(intro)}</p>` : ""}</header>${body}</main>`;

const table = (tokens: GuideToken[]): string =>
  `<div class="table-wrap"><table><thead><tr><th>Token</th><th>Type</th><th>Raw</th><th>Resolved</th><th>Alias</th><th>Source Set</th><th>Winning Set</th><th>CSS variable</th><th>Description</th></tr></thead><tbody>${tokens
    .map(
      (token) =>
        `<tr><td><code>${escape(token.name)}</code></td><td>${escape(token.type)}</td><td><code>${escape(value(token.rawValue))}</code></td><td><code>${escape(value(token.resolvedValue))}</code></td><td>${escape(token.aliasTarget)}</td><td>${escape(token.sourceSet)}</td><td>${escape(token.winningSet)}</td><td><code>${escape(token.cssVariable)}</code></td><td>${escape(token.description)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;

const visual = (
  tokens: GuideToken[],
  kind: "color" | "space" | "radius",
): string =>
  `<div class="samples">${tokens
    .map(
      (token) =>
        `<article class="sample"><div class="${kind}" style="${sampleStyle(token, kind)}"></div><strong>${escape(token.name)}</strong><code>${escape(value(token.resolvedValue))}</code><small>${escape(token.winningSet)}</small></article>`,
    )
    .join("")}</div>${table(tokens)}`;

const typedVisual = (tokens: GuideToken[]): string =>
  `<div class="samples">${tokens
    .map(
      (token) =>
        `<article class="sample"><div class="${token.section}" style="${sampleStyle(token, token.section)}">${token.section === "typography" ? "Ag" : ""}</div><strong>${escape(token.name)}</strong><code>${escape(value(token.resolvedValue))}</code><small>${escape(token.winningSet)}</small></article>`,
    )
    .join("")}</div>${table(tokens)}`;

function sampleStyle(
  token: GuideToken,
  kind: TokenSection | "color" | "space",
) {
  const result = value(token.resolvedValue);
  if (kind === "color") return `background:${escape(result)}`;
  if (kind === "space")
    return `width:min(${escape(result)},12rem);height:min(${escape(result)},12rem)`;
  if (kind === "radius") return `border-radius:${escape(result)}`;
  if (kind === "shadows") return `box-shadow:${escape(result)}`;
  if (kind === "opacity") return `opacity:${escape(result)}`;
  if (kind === "borders") return `border:${escape(result)}`;
  if (kind === "typography")
    return token.type.toLowerCase().includes("size")
      ? `font-size:${escape(result)}`
      : "";
  return "";
}

const story = (render: () => string): HtmlStory => ({ render });

export default { title: "Token guide" };
export const Overview = story(() =>
  shell(
    "Overview",
    `<dl><div><dt>Package</dt><dd><code>${escape(guide.packageName)}</code></dd></div><div><dt>Source commit</dt><dd><code>${escape(guide.sourceCommit)}</code></dd></div><div><dt>Validator</dt><dd><code>${escape(guide.validatorVersion)}</code></dd></div><div><dt>Contexts</dt><dd>${guide.contexts.length}</dd></div><div><dt>Tokens</dt><dd>${guide.tokens.length}</dd></div></dl><h2>Other token types</h2>${table(guide.tokens.filter((token) => token.section === "other"))}`,
    "Read-only documentation generated from canonical tokens and the shared validator graph.",
  ),
);
export const TokenSets = story(() =>
  shell(
    "Token Sets",
    `<ol>${guide.tokenSets.map((set, index) => `<li><strong>${index + 1}. ${escape(set)}</strong></li>`).join("")}</ol>`,
  ),
);
export const ThemesAndThemeGroups = story(() =>
  shell(
    "Themes and Theme Groups",
    guide.contexts
      .map(
        (context) =>
          `<section><h2>${escape(context.name)}</h2><p>${context.themes.map((theme) => `${escape(theme.group)}: <strong>${escape(theme.name)}</strong>`).join(" · ")}</p></section>`,
      )
      .join(""),
  ),
);
export const Colors = story(() =>
  shell(
    "Colors",
    visual(
      guide.tokens.filter((token) => token.section === "colors"),
      "color",
    ),
  ),
);
export const Typography = story(() =>
  shell(
    "Typography",
    typedVisual(guide.tokens.filter((token) => token.section === "typography")),
  ),
);
export const SpacingAndSizing = story(() =>
  shell(
    "Spacing and sizing",
    visual(
      guide.tokens.filter((token) => token.section === "spacing"),
      "space",
    ),
  ),
);
export const RadiusAndBorders = story(() =>
  shell(
    "Radius and borders",
    typedVisual(
      guide.tokens.filter(
        (token) => token.section === "radius" || token.section === "borders",
      ),
    ),
  ),
);
export const ShadowsAndOpacity = story(() =>
  shell(
    "Shadows and opacity",
    typedVisual(
      guide.tokens.filter(
        (token) => token.section === "shadows" || token.section === "opacity",
      ),
    ),
  ),
);
export const Aliases = story(() =>
  shell("Aliases", table(guide.tokens.filter((token) => token.aliasTarget))),
);
export const DeveloperUsage = story(() =>
  shell(
    "Developer usage",
    `<pre><code>npm install ./design-tokens-${escape(guide.projectId)}-v${escape(guide.version)}.tgz\n\nimport "${escape(guide.packageName)}/${escape(guide.cssFiles[0] ?? "theme.css")}";</code></pre><p>Set <code>data-color-scheme</code> on the document root or a scoped container. Choose one CSS export that matches the required Theme context.</p>`,
  ),
);
