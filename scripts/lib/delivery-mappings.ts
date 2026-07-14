import fs from "node:fs";
import path from "node:path";
import type { TargetDestination } from "./types.js";

export interface DeliveryMapping {
  label: string;
  source: string;
  destination: string;
  type: "extension" | "file";
  extension?: ".css" | ".json";
}

export function getDeliveryMappings(
  sourceDir: string,
  destination: TargetDestination & { css: string },
): DeliveryMapping[] {
  const mappings: DeliveryMapping[] = [
    {
      label: "css",
      source: sourceDir,
      destination: destination.css,
      type: "extension",
      extension: ".css",
    },
  ];

  if (destination.json) {
    mappings.push({
      label: "json",
      source: sourceDir,
      destination: destination.json,
      type: "extension",
      extension: ".json",
    });
  }

  if (destination.manifest) {
    mappings.push({
      label: "manifest",
      source: path.join(sourceDir, "manifest.json"),
      destination: destination.manifest,
      type: "file",
    });
  }

  for (const mapping of mappings) {
    if (!fs.existsSync(mapping.source)) {
      throw new Error(`Missing ${mapping.label} artifact: ${mapping.source}`);
    }
  }

  return mappings;
}
