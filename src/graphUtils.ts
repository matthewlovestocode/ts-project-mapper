import path from "node:path";
import type { ExportInfo, ImportInfo, ModuleNode, ProjectMap } from "./types.js";

/** Shared graph-traversal and formatting helpers used by every generate*() module. */

/** `filePath` relative to `rootDir`, with forward slashes regardless of platform. */
export function relativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

/** Renders one export as a markdown fragment, e.g. `` `foo` (type) `` or `` `x` ← re-exported from `./y` ``. */
export function formatExport(exp: ExportInfo): string {
  const suffix = exp.isTypeOnly ? " (type)" : "";
  const via = exp.reExportFrom ? ` ← re-exported from \`${exp.reExportFrom}\`` : "";
  return `\`${exp.name}\`${suffix}${via}`;
}

/** The local names an import declaration binds: default/namespace local names plus named imports. */
export function importedNames(imp: ImportInfo): string[] {
  return [
    imp.defaultImport ? `default as ${imp.defaultImport}` : null,
    imp.namespaceImport ? `* as ${imp.namespaceImport}` : null,
    ...imp.namedImports,
  ].filter((name): name is string => name !== null);
}

/** Renders one import as a markdown list item, e.g. `` - add from `lib/math.ts` ``. */
export function formatImport(imp: ImportInfo, rootDir: string): string {
  const names = importedNames(imp);
  const namesLabel = names.length > 0 ? names.join(", ") : "(side-effect only)";
  const target = imp.resolvedPath
    ? `\`${relativePath(rootDir, imp.resolvedPath)}\``
    : `\`${imp.specifier}\` (external)`;
  const typeLabel = imp.isTypeOnly ? " [type-only]" : "";

  return `- ${namesLabel} from ${target}${typeLabel}`;
}

/**
 * Every module that depends on `filePath`, whether directly (`import ... from`) or
 * via a barrel re-export (`export ... from`). Both count as "nothing else would work
 * if this file were deleted," which is what entry-point detection and "Used by" care about.
 */
export function findInternalDependents(projectMap: ProjectMap, filePath: string): ModuleNode[] {
  return projectMap.modules.filter(
    (module) =>
      module.imports.some((imp) => imp.resolvedPath === filePath) ||
      module.exports.some((exp) => exp.reExportResolvedPath === filePath),
  );
}

export function collectExternalSpecifiers(modules: ModuleNode[]): Set<string> {
  const specifiers = new Set<string>();
  for (const module of modules) {
    for (const imp of module.imports) {
      if (imp.resolvedPath === null) specifiers.add(imp.specifier);
    }
  }
  return specifiers;
}

/**
 * Modules nothing else in the project imports or re-exports. Not necessarily "exported
 * API" — a module with zero exports (an executable entry point, a test file) still
 * qualifies, since the defining trait is having no internal dependents.
 */
export function findEntryPoints(projectMap: ProjectMap): ModuleNode[] {
  return projectMap.modules.filter(
    (module) => findInternalDependents(projectMap, module.filePath).length === 0,
  );
}

/**
 * Looks up a module by a path as a user would type it on the CLI — relative to the
 * current directory or to the project root, with or without an extension — rather
 * than requiring the exact absolute path stored in ModuleNode.filePath.
 */
export function findModuleByPath(projectMap: ProjectMap, inputPath: string): ModuleNode | undefined {
  const bases = [path.resolve(inputPath), path.resolve(projectMap.rootDir, inputPath)];
  const suffixes = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

  for (const base of bases) {
    for (const suffix of suffixes) {
      const match = projectMap.modules.find((module) => module.filePath === base + suffix);
      if (match) return match;
    }
  }

  return undefined;
}
