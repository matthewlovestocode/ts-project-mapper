import type { ExportInfo, ImportInfo, ProjectMap } from "./types.js";
import {
  collectExternalSpecifiers,
  findEntryPoints,
  findInternalDependents,
  findModuleByPath,
  formatExport,
  formatImport,
  importedNames,
  relativePath,
} from "./graphUtils.js";

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

/** Plain-data shape behind generateSummary(), for callers that want structured output instead of markdown. */
export interface SummaryData {
  rootDir: string;
  moduleCount: number;
  externalDependencies: string[];
  /** Relative paths of modules nothing else in the project imports or re-exports. */
  entryPoints: string[];
}

/** Builds the {@link SummaryData} behind generateSummary(). */
export function buildSummaryData(projectMap: ProjectMap): SummaryData {
  const { rootDir, modules } = projectMap;

  return {
    rootDir,
    moduleCount: modules.length,
    externalDependencies: [...collectExternalSpecifiers(modules)].sort(),
    entryPoints: findEntryPoints(projectMap).map((module) => relativePath(rootDir, module.filePath)),
  };
}

/**
 * Cheap, bounded-size orientation: module count, external deps, and likely entry points —
 * no per-module dump. Meant to be the first call against an unfamiliar project, before
 * deciding which modules are worth a generateFocus() or a direct file read.
 */
export function generateSummary(projectMap: ProjectMap): string {
  const data = buildSummaryData(projectMap);
  const lines: string[] = [];

  lines.push("# Project Summary", "");
  lines.push(`Root: \`${data.rootDir}\``, "");
  lines.push(`${data.moduleCount} module${data.moduleCount === 1 ? "" : "s"} analyzed.`, "");

  if (data.externalDependencies.length > 0) {
    lines.push("## External Dependencies", "");
    for (const specifier of data.externalDependencies) {
      lines.push(`- \`${specifier}\``);
    }
    lines.push("");
  }

  if (data.entryPoints.length > 0) {
    lines.push("## Likely Entry Points", "");
    lines.push(
      "_Modules that nothing else in the project imports — public API surfaces, executables, or tests._",
      "",
    );
    for (const entryPoint of data.entryPoints) {
      lines.push(`- \`${entryPoint}\``);
    }
    lines.push("");
  }

  lines.push(
    "Use `generateFocus(projectMap, file)` (or `--focus <file>`) to inspect one module's " +
      "imports, exports, and dependents without pulling the full map.",
  );

  return lines.join("\n");
}

/** One module that depends on the focused module, and what it binds from it. */
export interface FocusDependent {
  filePath: string;
  relativePath: string;
  /** The local names this dependent binds from the focused module's imports/exports. */
  importedNames: string[];
}

/** Plain-data shape behind generateFocus(), for callers that want structured output instead of markdown. */
export interface FocusData {
  filePath: string;
  relativePath: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  dependents: FocusDependent[];
}

/** Builds {@link FocusData} for the module matching `targetPath`, or `null` if none matches. */
export function buildFocusData(projectMap: ProjectMap, targetPath: string): FocusData | null {
  const module = findModuleByPath(projectMap, targetPath);
  if (!module) return null;

  const { rootDir } = projectMap;
  const dependents = findInternalDependents(projectMap, module.filePath).map((dependent) => ({
    filePath: dependent.filePath,
    relativePath: relativePath(rootDir, dependent.filePath),
    importedNames: dependent.imports
      .filter((imp) => imp.resolvedPath === module.filePath)
      .flatMap(importedNames),
  }));

  return {
    filePath: module.filePath,
    relativePath: relativePath(rootDir, module.filePath),
    exports: module.exports,
    imports: module.imports,
    dependents,
  };
}

/**
 * Targeted view of a single module: its own exports/imports, plus every module that depends
 * on it and which specific names each pulls in. Resolves `targetPath` against both the cwd
 * and the project's rootDir, with the same extension fallbacks as internal import resolution.
 */
export function generateFocus(projectMap: ProjectMap, targetPath: string): string {
  const data = buildFocusData(projectMap, targetPath);
  if (!data) {
    return `No module found matching \`${targetPath}\`.`;
  }

  const lines: string[] = [];
  lines.push(`# Focus: \`${data.relativePath}\``, "");

  lines.push(
    data.exports.length > 0
      ? `**Exports:** ${data.exports.map(formatExport).join(", ")}`
      : "**Exports:** _none_",
    "",
  );

  if (data.imports.length > 0) {
    lines.push("**Imports:**", "");
    for (const imp of data.imports) {
      lines.push(formatImport(imp, projectMap.rootDir));
    }
    lines.push("");
  }

  if (data.dependents.length > 0) {
    lines.push("**Used by:**", "");
    for (const dependent of data.dependents) {
      const label = dependent.importedNames.length > 0 ? ` (${dependent.importedNames.join(", ")})` : "";
      lines.push(`- \`${dependent.relativePath}\`${label}`);
    }
    lines.push("");
  } else {
    lines.push("**Used by:** _nothing in this project — likely an entry point_", "");
  }

  return lines.join("\n");
}
