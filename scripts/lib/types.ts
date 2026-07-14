import type { TokenDocument as SharedTokenDocument } from "@eknvn/token-validator";

export type TokenDocument = SharedTokenDocument;

export interface TokenProject {
  id: string;
  tokenFile: string;
  outputDir: string;
}
export interface ProjectsConfig {
  projects?: TokenProject[];
}
export interface TargetDestination {
  css?: string;
  json?: string;
  manifest?: string;
}
export interface DeliveryConfig {
  provider?: unknown;
  branchPrefix?: unknown;
  branchName?: unknown;
  title?: unknown;
  body?: unknown;
  reviewers?: unknown;
  labels?: unknown;
}
export interface TargetConfig {
  project: string;
  repo: string;
  branch: string;
  source: string;
  destination?: TargetDestination;
  delivery?: DeliveryConfig;
}
export interface TargetsConfig {
  targets?: TargetConfig[];
}

export interface BuildManifest {
  projectId: string;
  outputs: Record<
    string,
    {
      themes: Array<{ group: string; id: string; name: string }>;
      css: string;
      json: string;
    }
  >;
}
