export type JsonObject = Record<string, unknown>;

export interface TokenLeaf {
  type?: string;
  value?: unknown;
  description?: string;
  $extensions?: {
    ekinoTokenArchitect?: {
      id?: unknown;
    };
    [key: string]: unknown;
  };
  original?: {
    value?: unknown;
  };
  name?: string;
  path?: string[];
}

export type TokenNode = Record<string, unknown>;
export type TokenDocument = Record<string, unknown>;

export interface TokenTheme {
  id?: unknown;
  name?: unknown;
  selectedTokenSets?: Record<string, unknown>;
  $extensions?: {
    ekinoTokenArchitect?: {
      modeSets?: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface TokenProject {
  id: string;
  tokenFile: string;
  outputDir: string;
  blockPools?: string[];
  [key: string]: unknown;
}

export interface ProjectsConfig {
  projects?: TokenProject[];
}

export interface TargetDestination {
  css?: string;
  html?: string;
  json?: string;
  manifest?: string;
  [key: string]: unknown;
}

export interface TargetConfig {
  project: string;
  repo: string;
  branch: string;
  source: string;
  destination?: TargetDestination;
  delivery?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TargetsConfig {
  targets?: TargetConfig[];
}

export interface BuildTheme {
  id: string;
  name: string;
  sets: string[];
  sourceSets?: string[];
  modeSets?: string[];
  outputId: string;
}

export interface ManifestThemeEntry {
  css: string;
  resolvedTokens: string;
  metadata: string;
}

export interface BuildManifest {
  project: string;
  version: string;
  buildTime: string;
  sourceCommit: string;
  css: string;
  referenceCss?: string;
  themes: Record<string, ManifestThemeEntry>;
  html: Record<string, string>;
}
