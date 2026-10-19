import path from "node:path";
import { analyzeModule } from "./analyzeModule.js";
import { discoverFiles } from "./discoverFiles.js";
import { loadAliasConfig } from "./loadAliasConfig.js";
import type { ProjectMap } from "./types.js";

export * from "./types.js";
export { generateDocs, generateFocus, generateSummary, buildSummaryData, buildFocusData } from "./generateDocs.js";
export type { SummaryData, FocusData, FocusDependent } from "./generateDocs.js";
export { generateGraph } from "./generateGraph.js";
export { generateFind, buildFindData } from "./generateFind.js";
export type { FindData, FindDefinition, FindUsage } from "./generateFind.js";
export { generateImpact, buildImpactData } from "./generateImpact.js";
export type { ImpactData, ImpactedModule } from "./generateImpact.js";
export { generateCycles, buildCycleData } from "./generateCycles.js";
export type { CycleData } from "./generateCycles.js";
export { generateUnused, buildUnusedData } from "./generateUnused.js";
export type { UnusedData, UnusedExport } from "./generateUnused.js";
export { generateMissingDocs, buildMissingDocsData } from "./generateMissingDocs.js";
export type { MissingDocsData, MissingDoc } from "./generateMissingDocs.js";
export { loadAliasConfig } from "./loadAliasConfig.js";
export type { AliasConfig } from "./loadAliasConfig.js";

/**
 * Builds the import/export graph for every .ts/.tsx file under `rootDir`.
 *
 * If a tsconfig.json with `compilerOptions.paths` is found at or above `rootDir`, bare
 * specifiers matching an alias pattern (e.g. `"@/lib/foo"`) are resolved to their real
 * file, the same way TypeScript itself would.
 *
 * @param rootDir - Directory to scan, e.g. a project's `src/`.
 * @returns A ProjectMap describing every module found.
 */
export function mapProject(rootDir: string): ProjectMap {
  const absoluteRoot = path.resolve(rootDir);
  const aliasConfig = loadAliasConfig(absoluteRoot);
  const files = discoverFiles(absoluteRoot);
  const modules = files.map((filePath) => analyzeModule(filePath, aliasConfig));
  return { rootDir: absoluteRoot, modules };
}
