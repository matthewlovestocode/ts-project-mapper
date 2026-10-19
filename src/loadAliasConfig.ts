import path from "node:path";
import ts from "typescript";

/** Resolved alias settings pulled from a project's tsconfig.json. */
export interface AliasConfig {
  /** Absolute directory that alias targets in `paths` are resolved against. */
  baseDir: string;
  /** Raw `compilerOptions.paths` map, e.g. `{ "@/*": ["src/*"] }`. */
  paths: Record<string, string[]>;
}

/**
 * Finds and parses the nearest tsconfig.json (following `extends` chains) to pull out
 * compilerOptions.paths/baseUrl, so bare specifiers like "@/lib/foo" can be resolved to
 * real files instead of being misclassified as external packages.
 */
export function loadAliasConfig(rootDir: string): AliasConfig | null {
  // Walks upward from rootDir looking for a tsconfig.json, the same way `tsc` would.
  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return null;

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) return null;

  // parseJsonConfigFileContent follows `extends` chains and fully resolves
  // compilerOptions, so a base config's paths/baseUrl are picked up too.
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  const { paths, baseUrl } = parsed.options;

  if (!paths || Object.keys(paths).length === 0) return null;

  // Per TS rules, `paths` without an explicit `baseUrl` resolves relative to the
  // tsconfig's own directory.
  const baseDir = path.resolve(path.dirname(configPath), baseUrl ?? ".");

  return { baseDir, paths };
}
