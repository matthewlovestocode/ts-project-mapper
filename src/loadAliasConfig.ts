import path from "node:path";
import ts from "typescript";

export interface AliasConfig {
  baseDir: string;
  paths: Record<string, string[]>;
}

/**
 * Finds and parses the nearest tsconfig.json (following `extends` chains) to pull out
 * compilerOptions.paths/baseUrl, so bare specifiers like "@/lib/foo" can be resolved to
 * real files instead of being misclassified as external packages.
 */
export function loadAliasConfig(rootDir: string): AliasConfig | null {
  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return null;

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) return null;

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  const { paths, baseUrl } = parsed.options;

  if (!paths || Object.keys(paths).length === 0) return null;

  const baseDir = path.resolve(path.dirname(configPath), baseUrl ?? ".");

  return { baseDir, paths };
}
