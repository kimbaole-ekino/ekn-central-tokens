import fs from "node:fs";
import path from "node:path";

export function copyArtifactsRecursively(
  source: string,
  destination: string,
  extension: ".css" | ".json",
): void {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === "manifest.json") continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyArtifactsRecursively(sourcePath, destinationPath, extension);
    } else if (path.extname(entry.name) === extension) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.cpSync(sourcePath, destinationPath);
    }
  }
}
