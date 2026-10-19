import fs from "node:fs";
import path from "node:path";

// Directories never worth descending into: build output, VCS metadata, dependencies.
const DEFAULT_IGNORED_DIRS = new Set(["node_modules", "dist", ".git", "build", "out"]);
const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Recursively finds every TypeScript source file under `rootDir`.
 *
 * Skips `.d.ts` declaration files (they're generated output, not source to analyze)
 * and, by default, common non-source directories like `node_modules` and `dist`.
 *
 * @param rootDir - Directory to walk.
 * @param ignoredDirs - Directory names to skip entirely, matched by exact name
 *   (not path). Defaults to {@link DEFAULT_IGNORED_DIRS}.
 * @returns Absolute paths to every matching file, in directory-walk order.
 */
export function discoverFiles(rootDir: string, ignoredDirs: Set<string> = DEFAULT_IGNORED_DIRS): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoredDirs.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && TS_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}
