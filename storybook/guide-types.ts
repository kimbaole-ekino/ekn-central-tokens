export type TokenSection =
  | "colors"
  | "typography"
  | "spacing"
  | "radius"
  | "borders"
  | "shadows"
  | "opacity"
  | "other";

export interface GuideTheme {
  id: string;
  name: string;
  group: string;
}

export interface GuideContext {
  name: string;
  themes: GuideTheme[];
}

export interface GuideToken {
  context: string;
  name: string;
  type: string;
  rawValue: unknown;
  resolvedValue: unknown;
  aliasTarget?: string;
  sourceSet: string;
  winningSet: string;
  cssVariable?: string;
  description?: string;
  section: TokenSection;
}

export interface TokenGuide {
  projectId: string;
  packageName: string;
  version: string;
  sourceCommit: string;
  validatorVersion: string;
  tokenSets: string[];
  contexts: GuideContext[];
  cssFiles: string[];
  tokens: GuideToken[];
}
