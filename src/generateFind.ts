import { relativePath } from "./graphUtils.js";
import type { ExportInfo, ProjectMap } from "./types.js";

/** One module that exports the searched-for name. */
export interface FindDefinition {
  filePath: string;
  relativePath: string;
  export: ExportInfo;
}

/** One module that imports the searched-for name, and how it binds it. */
export interface FindUsage {
  filePath: string;
  relativePath: string;
  /** How the importing module binds `query`: a named import, the default/namespace local name, or an external package specifier. */
  kind: "named" | "default" | "namespace" | "external";
}

/** Plain-data shape behind generateFind(). */
export interface FindData {
  query: string;
  definitions: FindDefinition[];
  usages: FindUsage[];
}

/**
 * Searches the whole project for a name, rather than requiring a file path up front
 * (what generateFocus() needs). Covers the common real starting point: an agent has a
 * symbol name from an error message, a grep hit, or a stack trace, and needs to find
 * where it's defined and who else uses it.
 */
export function buildFindData(projectMap: ProjectMap, query: string): FindData {
  const { rootDir, modules } = projectMap;

  const definitions: FindDefinition[] = [];
  for (const module of modules) {
    for (const exp of module.exports) {
      if (exp.name === query) {
        definitions.push({ filePath: module.filePath, relativePath: relativePath(rootDir, module.filePath), export: exp });
      }
    }
  }

  const usages: FindUsage[] = [];
  for (const module of modules) {
    for (const imp of module.imports) {
      let kind: FindUsage["kind"] | null = null;
      if (imp.namedImports.includes(query)) kind = "named";
      else if (imp.defaultImport === query) kind = "default";
      else if (imp.namespaceImport === query) kind = "namespace";
      else if (imp.resolvedPath === null && imp.specifier === query) kind = "external";

      if (kind) {
        usages.push({ filePath: module.filePath, relativePath: relativePath(rootDir, module.filePath), kind });
      }
    }
  }

  return { query, definitions, usages };
}

/** Renders buildFindData() as markdown. */
export function generateFind(projectMap: ProjectMap, query: string): string {
  const data = buildFindData(projectMap, query);
  const lines: string[] = [];

  lines.push(`# Find: \`${query}\``, "");

  if (data.definitions.length === 0 && data.usages.length === 0) {
    lines.push(`No exports or imports named \`${query}\` found.`);
    return lines.join("\n");
  }

  if (data.definitions.length > 0) {
    lines.push("## Defined in", "");
    for (const def of data.definitions) {
      const typeLabel = def.export.isTypeOnly ? " (type)" : "";
      lines.push(`- \`${def.relativePath}\`${typeLabel}`);
    }
    lines.push("");
  }

  if (data.usages.length > 0) {
    lines.push("## Imported in", "");
    for (const usage of data.usages) {
      const kindLabel = usage.kind === "external" ? " (external package)" : ` (${usage.kind} import)`;
      lines.push(`- \`${usage.relativePath}\`${kindLabel}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
