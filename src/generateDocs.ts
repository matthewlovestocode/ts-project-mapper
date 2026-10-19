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

function formatImport(imp: ImportInfo, rootDir: string): string {
  const names = [
    imp.defaultImport ? `default as ${imp.defaultImport}` : null,
    imp.namespaceImport ? `* as ${imp.namespaceImport}` : null,
    ...imp.namedImports,
  ].filter((name): name is string => name !== null);

  const namesLabel = names.length > 0 ? names.join(", ") : "(side-effect only)";
  const target = imp.resolvedPath
    ? `\`${relativePath(rootDir, imp.resolvedPath)}\``
    : `\`${imp.specifier}\` (external)`;
  const typeLabel = imp.isTypeOnly ? " [type-only]" : "";

  return `- ${namesLabel} from ${target}${typeLabel}`;
}

function findInternalDependents(projectMap: ProjectMap, filePath: string): ModuleNode[] {
  return projectMap.modules.filter(
    (module) =>
      module.imports.some((imp) => imp.resolvedPath === filePath) ||
      module.exports.some((exp) => exp.reExportResolvedPath === filePath),
  );
}

export function generateDocs(projectMap: ProjectMap): string {
  const { rootDir, modules } = projectMap;
  const lines: string[] = [];

  lines.push("# Project Map", "");
  lines.push(`Root: \`${rootDir}\``, "");
  lines.push(`Analyzed ${modules.length} module${modules.length === 1 ? "" : "s"}.`, "");

  const externalSpecifiers = new Set<string>();
  for (const module of modules) {
    for (const imp of module.imports) {
      if (imp.resolvedPath === null) externalSpecifiers.add(imp.specifier);
    }
  }

  if (externalSpecifiers.size > 0) {
    lines.push("## External Dependencies", "");
    for (const specifier of [...externalSpecifiers].sort()) {
      lines.push(`- \`${specifier}\``);
    }
    lines.push("");
  }

  const entryPoints = modules.filter(
    (module) => module.exports.length > 0 && findInternalDependents(projectMap, module.filePath).length === 0,
  );

  if (entryPoints.length > 0) {
    lines.push("## Likely Entry Points", "");
    lines.push(
      "_Modules with exports that nothing else in the project imports — likely public API surfaces or executables._",
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
