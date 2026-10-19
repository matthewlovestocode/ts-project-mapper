import { findInternalDependents, findModuleByPath, relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/** One module reached while walking the target module's dependents outward. */
export interface ImpactedModule {
  filePath: string;
  relativePath: string;
  /** Hops from the target module: 1 = direct dependent, 2 = depends on a direct dependent, etc. */
  depth: number;
}

/** Plain-data shape behind generateImpact(). */
export interface ImpactData {
  filePath: string;
  relativePath: string;
  /** Every module reachable by following "used by" edges outward, in breadth-first order. */
  affected: ImpactedModule[];
}

/**
 * The full transitive "blast radius" of a module: not just its direct dependents
 * (what generateFocus() shows), but everything that would be affected through any
 * chain of dependents — the actual question behind "what could break if I change this."
 */
export function buildImpactData(projectMap: ProjectMap, targetPath: string): ImpactData | null {
  const module = findModuleByPath(projectMap, targetPath);
  if (!module) return null;

  const { rootDir } = projectMap;
  const visited = new Set<string>([module.filePath]);
  const affected: ImpactedModule[] = [];

  let frontier = [module.filePath];
  let depth = 0;

  while (frontier.length > 0) {
    depth += 1;
    const nextFrontier: string[] = [];

    for (const filePath of frontier) {
      for (const dependent of findInternalDependents(projectMap, filePath)) {
        if (visited.has(dependent.filePath)) continue;
        visited.add(dependent.filePath);
        affected.push({ filePath: dependent.filePath, relativePath: relativePath(rootDir, dependent.filePath), depth });
        nextFrontier.push(dependent.filePath);
      }
    }

    frontier = nextFrontier;
  }

  return { filePath: module.filePath, relativePath: relativePath(rootDir, module.filePath), affected };
}

/** Renders buildImpactData() as markdown, grouped by hop count. */
export function generateImpact(projectMap: ProjectMap, targetPath: string): string {
  const data = buildImpactData(projectMap, targetPath);
  if (!data) {
    return `No module found matching \`${targetPath}\`.`;
  }

  const lines: string[] = [`# Impact: \`${data.relativePath}\``, ""];

  if (data.affected.length === 0) {
    lines.push("Nothing in this project depends on this module, directly or transitively.");
    return lines.join("\n");
  }

  lines.push(
    `${data.affected.length} module${data.affected.length === 1 ? "" : "s"} would be affected by a change here, ` +
      "directly or through a chain of dependents:",
    "",
  );

  const maxDepth = Math.max(...data.affected.map((m) => m.depth));
  for (let depth = 1; depth <= maxDepth; depth++) {
    const atDepth = data.affected.filter((m) => m.depth === depth);
    if (atDepth.length === 0) continue;

    lines.push(depth === 1 ? "## Direct dependents" : `## ${depth} hops away`, "");
    for (const module of atDepth) {
      lines.push(`- \`${module.relativePath}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}
