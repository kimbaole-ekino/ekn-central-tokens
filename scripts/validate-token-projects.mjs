import path from "node:path";
import {
  getProjectsConfig,
  readJson,
  validateTokenDocument,
} from "./token-build-utils.mjs";

const rootDir = process.cwd();
const config = getProjectsConfig(rootDir);

for (const project of config.projects ?? []) {
  const tokenPath = path.join(rootDir, project.tokenFile);
  const tokens = readJson(tokenPath);
  validateTokenDocument(tokens, project.tokenFile);
}

console.log(`Validated ${config.projects?.length ?? 0} token project(s).`);
