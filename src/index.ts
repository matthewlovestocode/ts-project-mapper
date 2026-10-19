import path from "node:path";
import { analyzeModule } from "./analyzeModule.js";
import { discoverFiles } from "./discoverFiles.js";
import type { ProjectMap } from "./types.js";

export * from "./types.js";
export { generateDocs, generateFocus, generateSummary } from "./generateDocs.js";

export function mapProject(rootDir: string): ProjectMap {
  const absoluteRoot = path.resolve(rootDir);
  const files = discoverFiles(absoluteRoot);
  const modules = files.map((filePath) => analyzeModule(filePath));
  return { rootDir: absoluteRoot, modules };
}
