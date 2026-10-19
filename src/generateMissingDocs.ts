import { relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/** One exported declaration with no JSDoc comment. */
export interface MissingDoc {
  filePath: string;
  relativePath: string;
  name: string;
  isTypeOnly: boolean;
}

/** Plain-data shape behind generateMissingDocs(). */
export interface MissingDocsData {
  missing: MissingDoc[];
}

/**
 * Finds exported declarations with no JSDoc comment — a punch list for an agent to work
 * through, not something this tool writes itself. Only covers exports defined directly in
 * a module (`export function foo() {}`, etc.); re-exports are skipped, since `hasJsDoc` is
 * only meaningful at the original definition (see {@link ExportInfo.hasJsDoc}).
 */
export function buildMissingDocsData(projectMap: ProjectMap): MissingDocsData {
  const { rootDir, modules } = projectMap;
  const missing: MissingDoc[] = [];

  for (const module of modules) {
    for (const exp of module.exports) {
      if (exp.hasJsDoc === false) {
        missing.push({
          filePath: module.filePath,
          relativePath: relativePath(rootDir, module.filePath),
          name: exp.name,
          isTypeOnly: exp.isTypeOnly,
        });
      }
    }
  }

  return { missing };
}

/** Renders buildMissingDocsData() as markdown. */
export function generateMissingDocs(projectMap: ProjectMap): string {
  const { missing } = buildMissingDocsData(projectMap);
  const lines: string[] = ["# Exports Missing JSDoc", ""];

  if (missing.length === 0) {
    lines.push("Every exported declaration has a JSDoc comment.");
    return lines.join("\n");
  }

  for (const item of missing) {
    const typeLabel = item.isTypeOnly ? " (type)" : "";
    lines.push(`- \`${item.name}\`${typeLabel} in \`${item.relativePath}\``);
  }

  return lines.join("\n");
}
