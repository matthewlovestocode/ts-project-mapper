import path from "node:path";
import type { ExportInfo, ImportInfo, ModuleNode, ProjectMap } from "./types.js";

function relativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function formatExport(exp: ExportInfo): string {
  const suffix = exp.isTypeOnly ? " (type)" : "";
  const via = exp.reExportFrom ? ` ← re-exported from \`${exp.reExportFrom}\`` : "";
  return `\`${exp.name}\`${suffix}${via}`;
}

function importedNames(imp: ImportInfo): string[] {
  return [
    imp.defaultImport ? `default as ${imp.defaultImport}` : null,
    imp.namespaceImport ? `* as ${imp.namespaceImport}` : null,
    ...imp.namedImports,
  ].filter((name): name is string => name !== null);
}

function formatImport(imp: ImportInfo, rootDir: string): string {
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
function findInternalDependents(projectMap: ProjectMap, filePath: string): ModuleNode[] {
  return projectMap.modules.filter(
    (module) =>
      module.imports.some((imp) => imp.resolvedPath === filePath) ||
      module.exports.some((exp) => exp.reExportResolvedPath === filePath),
  );
}

function collectExternalSpecifiers(modules: ModuleNode[]): Set<string> {
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
function findEntryPoints(projectMap: ProjectMap): ModuleNode[] {
  return projectMap.modules.filter(
    (module) => findInternalDependents(projectMap, module.filePath).length === 0,
  );
}

/**
 * Looks up a module by a path as a user would type it on the CLI — relative to the
 * current directory or to the project root, with or without an extension — rather
 * than requiring the exact absolute path stored in ModuleNode.filePath.
 */
function findModuleByPath(projectMap: ProjectMap, inputPath: string): ModuleNode | undefined {
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

/**
 * Full project map: external deps, entry points, and every module's exports/imports/dependents.
 * Cost scales with project size — prefer generateSummary() for first-pass orientation on large
 * projects, and generateFocus() to drill into a specific module once you know where to look.
 */
export function generateDocs(projectMap: ProjectMap): string {
  const { rootDir, modules } = projectMap;
  const lines: string[] = [];

  lines.push("# Project Map", "");
  lines.push(`Root: \`${rootDir}\``, "");
  lines.push(`Analyzed ${modules.length} module${modules.length === 1 ? "" : "s"}.`, "");

  const externalSpecifiers = collectExternalSpecifiers(modules);
  if (externalSpecifiers.size > 0) {
    lines.push("## External Dependencies", "");
    for (const specifier of [...externalSpecifiers].sort()) {
      lines.push(`- \`${specifier}\``);
    }
    lines.push("");
  }

  const entryPoints = findEntryPoints(projectMap);
  if (entryPoints.length > 0) {
    lines.push("## Likely Entry Points", "");
    lines.push(
      "_Modules that nothing else in the project imports — public API surfaces, executables, or tests._",
      "",
    );
    for (const module of entryPoints) {
      lines.push(`- \`${relativePath(rootDir, module.filePath)}\``);
    }
    lines.push("");
  }

  lines.push("## Modules", "");

  const sortedModules = [...modules].sort((a, b) => a.filePath.localeCompare(b.filePath));

  for (const module of sortedModules) {
    const relPath = relativePath(rootDir, module.filePath);
    lines.push(`### \`${relPath}\``, "");

    lines.push(
      module.exports.length > 0
        ? `**Exports:** ${module.exports.map(formatExport).join(", ")}`
        : "**Exports:** _none_",
      "",
    );

    if (module.imports.length > 0) {
      lines.push("**Imports:**", "");
      for (const imp of module.imports) {
        lines.push(formatImport(imp, rootDir));
      }
      lines.push("");
    }

    const dependents = findInternalDependents(projectMap, module.filePath);
    if (dependents.length > 0) {
      lines.push(
        `**Used by:** ${dependents.map((d) => `\`${relativePath(rootDir, d.filePath)}\``).join(", ")}`,
        "",
      );
    }
  }

  return lines.join("\n");
}

/**
 * Cheap, bounded-size orientation: module count, external deps, and likely entry points —
 * no per-module dump. Meant to be the first call against an unfamiliar project, before
 * deciding which modules are worth a generateFocus() or a direct file read.
 */
export function generateSummary(projectMap: ProjectMap): string {
  const { rootDir, modules } = projectMap;
  const lines: string[] = [];

  lines.push("# Project Summary", "");
  lines.push(`Root: \`${rootDir}\``, "");
  lines.push(`${modules.length} module${modules.length === 1 ? "" : "s"} analyzed.`, "");

  const externalSpecifiers = collectExternalSpecifiers(modules);
  if (externalSpecifiers.size > 0) {
    lines.push("## External Dependencies", "");
    for (const specifier of [...externalSpecifiers].sort()) {
      lines.push(`- \`${specifier}\``);
    }
    lines.push("");
  }

  const entryPoints = findEntryPoints(projectMap);
  if (entryPoints.length > 0) {
    lines.push("## Likely Entry Points", "");
    lines.push(
      "_Modules that nothing else in the project imports — public API surfaces, executables, or tests._",
      "",
    );
    for (const module of entryPoints) {
      lines.push(`- \`${relativePath(rootDir, module.filePath)}\``);
    }
    lines.push("");
  }

  lines.push(
    "Use `generateFocus(projectMap, file)` (or `--focus <file>`) to inspect one module's " +
      "imports, exports, and dependents without pulling the full map.",
  );

  return lines.join("\n");
}

/**
 * Targeted view of a single module: its own exports/imports, plus every module that depends
 * on it and which specific names each pulls in. Resolves `targetPath` against both the cwd
 * and the project's rootDir, with the same extension fallbacks as internal import resolution.
 */
export function generateFocus(projectMap: ProjectMap, targetPath: string): string {
  const { rootDir } = projectMap;
  const module = findModuleByPath(projectMap, targetPath);

  if (!module) {
    return `No module found matching \`${targetPath}\`.`;
  }

  const relPath = relativePath(rootDir, module.filePath);
  const lines: string[] = [];

  lines.push(`# Focus: \`${relPath}\``, "");

  lines.push(
    module.exports.length > 0
      ? `**Exports:** ${module.exports.map(formatExport).join(", ")}`
      : "**Exports:** _none_",
    "",
  );

  if (module.imports.length > 0) {
    lines.push("**Imports:**", "");
    for (const imp of module.imports) {
      lines.push(formatImport(imp, rootDir));
    }
    lines.push("");
  }

  const dependents = findInternalDependents(projectMap, module.filePath);
  if (dependents.length > 0) {
    lines.push("**Used by:**", "");
    for (const dependent of dependents) {
      const names = dependent.imports
        .filter((imp) => imp.resolvedPath === module.filePath)
        .flatMap(importedNames);
      const label = names.length > 0 ? ` (${names.join(", ")})` : "";
      lines.push(`- \`${relativePath(rootDir, dependent.filePath)}\`${label}`);
    }
    lines.push("");
  } else {
    lines.push("**Used by:** _nothing in this project — likely an entry point_", "");
  }

  return lines.join("\n");
}
