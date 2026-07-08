import path from "node:path";
import StyleDictionary from "style-dictionary";
import { propertyFormatNames } from "style-dictionary/enums";
import {
  createPropertyFormatter,
  formattedVariables,
  getReferences,
  usesReferences,
} from "style-dictionary/utils";
import { register as registerTokenTransforms } from "@tokens-studio/sd-transforms";
import type { TokenDocument, TokenLeaf } from "./types.js";
import { compactObject } from "./token-utils.js";
import { kebabSegment } from "./themes.js";

export const GENERATED_FILE_HEADER =
  "/* Do not edit directly, this file was auto-generated. */";

type CssLayer = "all" | "semantic" | "reference";

interface DictionaryToken extends TokenLeaf {
  name?: string;
  path?: string[];
}

interface DictionaryLike {
  allTokens?: DictionaryToken[];
  tokens?: unknown;
  unfilteredTokens?: unknown;
}

interface BuildThemeOptions {
  tokens: TokenDocument;
  outputDir: string;
  cssFile: string;
  resolvedTokensFile: string;
  metadataFile: string;
  themeId: string;
  colorSchemeRootSegments: Set<string>;
  splitReferenceCss: boolean;
}

export interface BuildThemeOutput {
  cssBlock: string;
  referenceCssDeclarations: CssVariableDeclaration[];
  variableNames: string[];
}

export interface CssVariableDeclaration {
  variableName: string;
  declaration: string;
  dependencies: string[];
}

let tokenTransformsRegistered = false;

export function registerStyleDictionaryTransforms(): void {
  if (tokenTransformsRegistered) return;
  registerTokenTransforms(StyleDictionary);
  tokenTransformsRegistered = true;
}

export async function buildThemeWithStyleDictionary({
  tokens,
  outputDir,
  cssFile,
  resolvedTokensFile,
  metadataFile,
  themeId,
  colorSchemeRootSegments,
  splitReferenceCss,
}: BuildThemeOptions): Promise<BuildThemeOutput> {
  const dictionary = new StyleDictionary({
    tokens: tokens as never,
    preprocessors: ["tokens-studio"],
    hooks: {
      formats: {
        "ekn/css-variables": ({ dictionary, options }) =>
          `${GENERATED_FILE_HEADER}\n\n${formatCssVariablesBlock({
            dictionary,
            selector: ":root",
            outputReferences: Boolean(options.outputReferences),
            themeId: String(options.themeId),
            colorSchemeRootSegments:
              options.colorSchemeRootSegments instanceof Set
                ? options.colorSchemeRootSegments
                : new Set<string>(),
            cssLayer: String(options.cssLayer) as CssLayer,
            splitReferenceCss: Boolean(options.splitReferenceCss),
          })}\n`,
        "ekn/resolved-tokens-json": ({ dictionary }) => {
          const resolvedTokens = Object.fromEntries(
            (dictionary.allTokens as DictionaryToken[])
              .map(
                (token) =>
                  [
                    token.path?.join(".") ?? token.name ?? "",
                    compactObject({
                      type: tokenType(token),
                      value: tokenValue(token),
                      description: tokenDescription(token),
                    }),
                  ] as const,
              )
              .sort(([left], [right]) => left.localeCompare(right)),
          );
          return `${JSON.stringify(resolvedTokens, null, 2)}\n`;
        },
        "ekn/metadata-json": ({ dictionary }) => {
          const metadata = Object.fromEntries(
            (dictionary.allTokens as DictionaryToken[])
              .map(
                (token) =>
                  [
                    token.path?.join(".") ?? token.name ?? "",
                    {
                      value: tokenValue(token),
                      originalValue: tokenOriginalValue(token),
                      cssVariable: `--${semanticCssTokenName(
                        token,
                        themeId,
                        colorSchemeRootSegments,
                      )}`,
                      theme: themeId,
                    },
                  ] as const,
              )
              .sort(([left], [right]) => left.localeCompare(right)),
          );
          return `${JSON.stringify(metadata, null, 2)}\n`;
        },
      },
    },
    platforms: {
      css: {
        transformGroup: "tokens-studio",
        transforms: ["name/kebab"],
        buildPath: `${path.join(outputDir, path.dirname(cssFile))}/`,
        files: [
          {
            destination: path.basename(cssFile),
            format: "ekn/css-variables",
            options: {
              outputReferences: true,
              themeId,
              colorSchemeRootSegments,
              cssLayer: "semantic",
              splitReferenceCss,
            },
          },
        ],
      },
      metadata: {
        transformGroup: "tokens-studio",
        transforms: ["name/kebab"],
        buildPath: `${path.join(outputDir, path.dirname(metadataFile))}/`,
        files: [
          {
            destination: path.basename(resolvedTokensFile),
            format: "ekn/resolved-tokens-json",
            options: {
              showFileHeader: false,
            },
          },
          {
            destination: path.basename(metadataFile),
            format: "ekn/metadata-json",
            options: {
              showFileHeader: false,
            },
          },
        ],
      },
    },
  });

  await dictionary.buildAllPlatforms();
  const cssDictionary = (await dictionary.getPlatformTokens(
    "css",
  )) as DictionaryLike;
  const cssBlock = formatCssVariablesBlock({
    dictionary: cssDictionary,
    selector: colorSchemeSelector(themeId),
    outputReferences: true,
    themeId,
    colorSchemeRootSegments,
    cssLayer: "semantic",
    splitReferenceCss,
  });
  const referenceCssDeclarations = splitReferenceCss
    ? formatCssVariableDeclarations({
        dictionary: cssDictionary,
        outputReferences: true,
        themeId,
        colorSchemeRootSegments,
        cssLayer: "reference",
        splitReferenceCss,
      })
    : [];

  return {
    cssBlock,
    referenceCssDeclarations,
    variableNames: getCssVariableNames(
      cssDictionary,
      "semantic",
      splitReferenceCss,
      colorSchemeRootSegments,
    ),
  };
}

function formatCssVariablesBlock({
  dictionary,
  selector,
  outputReferences,
  themeId,
  colorSchemeRootSegments,
  cssLayer = "all",
  splitReferenceCss = false,
}: {
  dictionary: DictionaryLike;
  selector: string;
  outputReferences: boolean;
  themeId: string;
  colorSchemeRootSegments: Set<string>;
  cssLayer?: CssLayer;
  splitReferenceCss?: boolean;
}): string {
  normalizeCssDictionaryNames(dictionary, themeId, colorSchemeRootSegments);
  const allTokens = dictionary.allTokens ?? [];
  const outputTokens = allTokens.filter((token) =>
    shouldIncludeCssToken(
      token,
      cssLayer,
      splitReferenceCss,
      colorSchemeRootSegments,
    ),
  );
  assertUniqueCssTokenNames(outputTokens, themeId);
  const variables = formattedVariables({
    format: propertyFormatNames.css,
    dictionary: {
      ...dictionary,
      allTokens: outputTokens,
    } as never,
    outputReferences,
    formatting: {
      indentation: "  ",
    },
  });

  return `${selector} {\n${variables}\n}`;
}

function formatCssVariableDeclarations({
  dictionary,
  outputReferences,
  themeId,
  colorSchemeRootSegments,
  cssLayer = "all",
  splitReferenceCss = false,
}: {
  dictionary: DictionaryLike;
  outputReferences: boolean;
  themeId: string;
  colorSchemeRootSegments: Set<string>;
  cssLayer?: CssLayer;
  splitReferenceCss?: boolean;
}): CssVariableDeclaration[] {
  normalizeCssDictionaryNames(dictionary, themeId, colorSchemeRootSegments);
  const allTokens = dictionary.allTokens ?? [];
  const outputTokens = allTokens.filter((token) =>
    shouldIncludeCssToken(
      token,
      cssLayer,
      splitReferenceCss,
      colorSchemeRootSegments,
    ),
  );
  assertUniqueCssTokenNames(outputTokens, themeId);
  const outputDictionary = {
    ...dictionary,
    allTokens: outputTokens,
  };
  const formatProperty = createPropertyFormatter({
    outputReferences,
    dictionary: outputDictionary as never,
    format: propertyFormatNames.css,
    formatting: {
      indentation: "",
    },
  });

  return outputTokens.flatMap((token) => {
    if (typeof token.name !== "string" || !token.name) return [];
    const declaration = formatProperty(token as never).trim();
    if (!declaration) return [];

    return [
      {
        variableName: `--${token.name}`,
        declaration,
        dependencies: getCssVariableDependenciesFromToken(
          token,
          dictionary,
          themeId,
          colorSchemeRootSegments,
          outputReferences,
        ),
      },
    ];
  });
}

function shouldIncludeCssToken(
  token: DictionaryToken,
  cssLayer: CssLayer,
  splitReferenceCss: boolean,
  colorSchemeRootSegments: Set<string>,
): boolean {
  if (!splitReferenceCss || cssLayer === "all") return true;

  const rootSegment = Array.isArray(token.path)
    ? kebabSegment(token.path[0])
    : "";
  const isColorSchemeToken = colorSchemeRootSegments.has(rootSegment);

  return cssLayer === "semantic" ? isColorSchemeToken : !isColorSchemeToken;
}

function normalizeCssDictionaryNames(
  dictionary: DictionaryLike,
  themeId: string,
  colorSchemeRootSegments: Set<string>,
): void {
  const normalizedTokens = new Set<DictionaryToken>();
  for (const token of dictionary.allTokens ?? []) {
    normalizeCssTokenName(
      token,
      themeId,
      colorSchemeRootSegments,
      normalizedTokens,
    );
  }
  assertUniqueCssTokenNames(dictionary.allTokens ?? [], themeId);
  normalizeCssTokenTree(
    dictionary.tokens,
    themeId,
    colorSchemeRootSegments,
    normalizedTokens,
  );
}

function assertUniqueCssTokenNames(
  tokens: DictionaryToken[],
  themeId: string,
): void {
  const tokenPathByName = new Map<string, string>();
  for (const token of tokens) {
    if (typeof token.name !== "string") continue;
    const tokenPath = Array.isArray(token.path)
      ? token.path.join(".")
      : token.name;
    const existingPath = tokenPathByName.get(token.name);
    if (existingPath && existingPath !== tokenPath) {
      throw new Error(
        `Theme ${themeId} produces duplicate CSS variable --${token.name} from ${existingPath} and ${tokenPath}.`,
      );
    }
    tokenPathByName.set(token.name, tokenPath);
  }
}

function normalizeCssTokenTree(
  node: unknown,
  themeId: string,
  colorSchemeRootSegments: Set<string>,
  normalizedTokens: Set<DictionaryToken>,
): void {
  if (!node || typeof node !== "object") return;
  normalizeCssTokenName(
    node as DictionaryToken,
    themeId,
    colorSchemeRootSegments,
    normalizedTokens,
  );
  for (const child of Object.values(node)) {
    normalizeCssTokenTree(
      child,
      themeId,
      colorSchemeRootSegments,
      normalizedTokens,
    );
  }
}

function normalizeCssTokenName(
  token: DictionaryToken,
  themeId: string,
  colorSchemeRootSegments: Set<string>,
  normalizedTokens: Set<DictionaryToken>,
): void {
  if (!token || normalizedTokens.has(token) || typeof token.name !== "string") {
    return;
  }
  normalizedTokens.add(token);
  token.name = semanticCssTokenName(token, themeId, colorSchemeRootSegments);
}

function semanticCssTokenName(
  token: DictionaryToken,
  themeId: string,
  colorSchemeRootSegments: Set<string>,
): string {
  if (!Array.isArray(token.path) || token.path.length < 2) {
    return token.name ?? "";
  }

  const rootSegment = kebabSegment(token.path[0]);
  const isColorSchemeRoot =
    rootSegment === themeId || colorSchemeRootSegments.has(rootSegment);
  if (!isColorSchemeRoot) {
    return token.name ?? "";
  }

  return (
    token.path
      .slice(1)
      .map((segment) => kebabSegment(segment))
      .filter(Boolean)
      .join("-") ||
    token.name ||
    ""
  );
}

function getCssVariableNames(
  dictionary: DictionaryLike,
  cssLayer: CssLayer = "all",
  splitReferenceCss = false,
  colorSchemeRootSegments = new Set<string>(),
): string[] {
  return (dictionary.allTokens ?? [])
    .filter((token) =>
      shouldIncludeCssToken(
        token,
        cssLayer,
        splitReferenceCss,
        colorSchemeRootSegments,
      ),
    )
    .map((token) => token.name)
    .filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    )
    .sort((left, right) => left.localeCompare(right));
}

function getCssVariableDependenciesFromToken(
  token: DictionaryToken,
  dictionary: DictionaryLike,
  themeId: string,
  colorSchemeRootSegments: Set<string>,
  outputReferences: boolean,
): string[] {
  if (!outputReferences) return [];
  const originalValue = tokenOriginalValue(token);
  if (!usesReferences(originalValue)) return [];

  const references = getReferences(
    originalValue as never,
    dictionary.tokens as never,
    {
      unfilteredTokens: dictionary.unfilteredTokens,
      warnImmediately: false,
    } as never,
  ) as DictionaryToken[];

  return [
    ...new Set(
      references
        .map((reference) => {
          const name =
            typeof reference.name === "string" && reference.name
              ? reference.name
              : semanticCssTokenName(
                  reference,
                  themeId,
                  colorSchemeRootSegments,
                );
          return name ? `--${name}` : "";
        })
        .filter(Boolean),
    ),
  ];
}

function colorSchemeSelector(schemeId: string): string {
  const quotedSchemeId = JSON.stringify(schemeId);
  return [
    `:root[data-color-scheme=${quotedSchemeId}]`,
    `[data-color-scheme=${quotedSchemeId}]`,
  ].join(",\n");
}

function tokenValue(token: TokenLeaf): unknown {
  return token.value;
}

function tokenOriginalValue(token: TokenLeaf): unknown {
  return token.original?.value ?? tokenValue(token);
}

function tokenType(token: TokenLeaf): unknown {
  return token.type;
}

function tokenDescription(token: TokenLeaf): unknown {
  return token.description;
}
