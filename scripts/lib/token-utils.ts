import fs from "node:fs";
import path from "node:path";
import {
  parseTokenDocument,
  validateTokenDocument as validateSharedTokenDocument,
} from "@eknvn/token-validator";
import type { ProjectsConfig, TargetsConfig, TokenDocument } from "./types.js";

export function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
export function readTokenDocument(filePath: string): TokenDocument {
  const parsed = parseTokenDocument(fs.readFileSync(filePath, "utf8"));
  if (!parsed.valid || !parsed.document)
    throw new Error(
      `${filePath} failed parsing:\n${parsed.diagnostics
        .map((item) => `${item.code}: ${item.message}`)
        .join("\n")}`,
    );
  return parsed.document;
}
export function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}
export function getProjectsConfig(rootDir: string): ProjectsConfig {
  return readJson(path.join(rootDir, "projects.config.json"));
}
export function getTargetsConfig(rootDir: string): TargetsConfig {
  return readJson(path.join(rootDir, "targets.config.json"));
}
export function validateTokenDocument(
  document: TokenDocument,
  sourceName: string,
): void {
  const validation = validateSharedTokenDocument(document, {
    profile: "submission",
  });
  if (!validation.valid)
    throw new Error(
      `${sourceName} failed validation:\n${validation.diagnostics.map((item) => `${item.code}: ${item.message}`).join("\n")}`,
    );
}
