import type { TokenDocument as SharedTokenDocument } from "@ekinotech/design-token-validator";

export type TokenDocument = SharedTokenDocument;

export interface TokenProject {
  id: string;
  tokenFile: string;
  outputDir: string;
  packageName: string;
  version: string;
  documentationSlug: string;
  enabled: boolean;
  disabledReason?: string;
}
export interface ProjectsConfig {
  projects?: TokenProject[];
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
