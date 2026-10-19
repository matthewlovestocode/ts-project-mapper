import fs from "node:fs";
import path from "node:path";
import type { AliasConfig } from "./loadAliasConfig.js";

// Tried in order against a candidate base path; "" checks the exact path first.
const RESOLUTION_SUFFIXES = ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"];
const JS_EXTENSION_PATTERN = /\.(js|jsx|mjs|cjs)$/;

function isFile(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

function resolveWithSuffixes(basePath: string): string | null {
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = basePath + suffix;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Matches a bare specifier against tsconfig `paths` patterns, mirroring TypeScript's own
 * rule: an exact (non-wildcard) key wins outright, otherwise the wildcard pattern with the
 * longest literal prefix wins. Returns the candidate target paths (still unresolved against
 * the filesystem) for the caller to try in order.
 */
function matchAliasTargets(specifier: string, paths: Record<string, string[]>): string[] | null {
  if (paths[specifier]) return paths[specifier];

  let best: { prefixLength: number; targets: string[] } | null = null;

  for (const [pattern, targets] of Object.entries(paths)) {
    const starIndex = pattern.indexOf("*");
    if (starIndex === -1) continue;

    const prefix = pattern.slice(0, starIndex);
    const suffix = pattern.slice(starIndex + 1);
    if (
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix) &&
      specifier.length >= prefix.length + suffix.length
    ) {
      const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
      if (!best || prefix.length > best.prefixLength) {
        best = { prefixLength: prefix.length, targets: targets.map((target) => target.replace("*", captured)) };
      }
    }
  }

  return best?.targets ?? null;
}

/**
 * Resolves an import specifier to an absolute file path, or `null` if it's external
 * (an npm package) or can't be matched to a file on disk.
 *
 * @param specifier - The specifier as written in the source, e.g. `"./foo.js"`, `"@/bar"`, `"zod"`.
 * @param fromFile - Absolute path of the file containing the import, used to resolve relative specifiers.
 * @param aliasConfig - tsconfig path-alias settings from {@link loadAliasConfig}, if any.
 */
export function resolveImport(specifier: string, fromFile: string, aliasConfig?: AliasConfig | null): string | null {
  if (specifier.startsWith(".")) {
    // NodeNext ESM resolution requires relative imports to reference the compiled ".js"
    // extension even though the source file on disk is ".ts"/".tsx".
    const specifierWithoutJsExtension = specifier.replace(JS_EXTENSION_PATTERN, "");
    const resolvedBase = path.resolve(path.dirname(fromFile), specifierWithoutJsExtension);
    return resolveWithSuffixes(resolvedBase);
  }

  // Not relative: it's either a path alias or a genuine external package. Try every
  // candidate target in order and take the first one that exists on disk.
  if (aliasConfig) {
    const targets = matchAliasTargets(specifier, aliasConfig.paths);
    if (targets) {
      for (const target of targets) {
        const resolvedBase = path.resolve(aliasConfig.baseDir, target.replace(JS_EXTENSION_PATTERN, ""));
        const resolved = resolveWithSuffixes(resolvedBase);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}
