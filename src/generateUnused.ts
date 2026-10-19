import { relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/** One export flagged as possibly unused. */
export interface UnusedExport {
  filePath: string;
  relativePath: string;
  name: string;
  isTypeOnly: boolean;
}

/** Plain-data shape behind generateUnused(). */
export interface UnusedData {
  unused: UnusedExport[];
}

/**
 * Flags exports nothing else in the scan imports by name or re-exports.
 *
 * This is a heuristic, not a guarantee of dead code:
 * - A namespace import (`import * as ns from "./x"`) marks the whole source module as
 *   used, since property access through `ns` isn't tracked — better a false negative
 *   than flagging real usage as unused.
 * - A named re-export (`export { x } from "./y"`) marks `x` as used on `y`, without
 *   checking whether the re-exported name is used any further downstream.
 * - `export * as ns from "./y"` isn't distinguished from a coincidentally-named
 *   `export { ns } from "./y"`, so it doesn't protect `y`'s real exports the way a
 *   plain `export *` wildcard does.
 * - Usage from outside the scanned directory (e.g. this package's own published API,
 *   consumed by projects not included in the scan) is invisible. Run this against a
 *   package's real entry point, not an arbitrary subdirectory, for reliable results.
 */
export function buildUnusedData(projectMap: ProjectMap): UnusedData {
  const { rootDir, modules } = projectMap;

  const usedNames = new Map<string, Set<string>>();
  const fullyUsed = new Set<string>();
  for (const module of modules) usedNames.set(module.filePath, new Set());

  for (const module of modules) {
    for (const imp of module.imports) {
      if (!imp.resolvedPath) continue;

      if (imp.namespaceImport) {
        fullyUsed.add(imp.resolvedPath);
        continue;
      }

      const names = usedNames.get(imp.resolvedPath);
      if (!names) continue;
      if (imp.defaultImport) names.add("default");
      for (const name of imp.namedImports) names.add(name);
    }

    for (const exp of module.exports) {
      if (!exp.reExportResolvedPath) continue;

      if (exp.name === "*") {
        // export * from "./x" — forwards every name from x; we can't know which
        // ones are actually consumed further downstream, so assume all of them are.
        fullyUsed.add(exp.reExportResolvedPath);
        continue;
      }

      usedNames.get(exp.reExportResolvedPath)?.add(exp.name);
    }
  }

  const unused: UnusedExport[] = [];
  for (const module of modules) {
    if (fullyUsed.has(module.filePath)) continue;

    const names = usedNames.get(module.filePath)!;
    for (const exp of module.exports) {
      if (exp.name === "*") continue; // this module's own wildcard re-export, not a name it defines
      if (!names.has(exp.name)) {
        unused.push({
          filePath: module.filePath,
          relativePath: relativePath(rootDir, module.filePath),
          name: exp.name,
          isTypeOnly: exp.isTypeOnly,
        });
      }
    }
  }

  return { unused };
}

/** Renders buildUnusedData() as markdown. */
export function generateUnused(projectMap: ProjectMap): string {
  const { unused } = buildUnusedData(projectMap);
  const lines: string[] = ["# Possibly Unused Exports", ""];

  lines.push(
    "_Heuristic — not a guarantee of dead code. An export counts as used if something in this " +
      "scan imports it by name or re-exports it; a namespace import marks its whole source module " +
      "as used, since property access through it can't be tracked. Usage from outside this scan " +
      "(e.g. this package's own published API) isn't visible — scan a package's real entry point, " +
      "not an arbitrary subdirectory, for reliable results._",
    "",
  );

  if (unused.length === 0) {
    lines.push("No unused exports found.");
    return lines.join("\n");
  }

  for (const item of unused) {
    const typeLabel = item.isTypeOnly ? " (type)" : "";
    lines.push(`- \`${item.name}\`${typeLabel} in \`${item.relativePath}\``);
  }

  return lines.join("\n");
}
