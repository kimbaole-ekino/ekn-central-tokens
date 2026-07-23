import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./token-utils.js";

export interface CentralBuildIdentity {
  centralVersion: string;
  centralCommit: string;
  validatorVersion: string;
}

export function getCentralBuildIdentity(
  root: string,
  centralCommit: string,
): CentralBuildIdentity {
  const central = readJson<{ name?: unknown; version?: unknown }>(
    path.join(root, "package.json"),
  );
  if (
    central.name !== "design-token-central" ||
    typeof central.version !== "string"
  ) {
    throw new Error(
      "Central package metadata must define design-token-central with a version.",
    );
  }
  const validatorEntry = fileURLToPath(
    import.meta.resolve("@ekinotech/design-token-validator"),
  );
  const validatorPackagePath = path.join(
    path.dirname(validatorEntry),
    "..",
    "package.json",
  );
  if (!fs.existsSync(validatorPackagePath)) {
    throw new Error("Installed Validator package metadata is missing.");
  }
  const validator = readJson<{ name?: unknown; version?: unknown }>(
    validatorPackagePath,
  );
  if (validator.name !== "@ekinotech/design-token-validator") {
    throw new Error("Installed Validator package name is invalid.");
  }
  if (typeof validator.version !== "string") {
    throw new Error("Installed Validator package version must be a string.");
  }
  return {
    centralVersion: central.version,
    centralCommit,
    validatorVersion: validator.version,
  };
}
