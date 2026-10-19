import { relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/** Plain-data shape behind generateCycles(). */
export interface CycleData {
  /** Each entry is one group of mutually-reachable modules (a strongly connected component), as relative paths. */
  cycles: string[][];
}

/**
 * Builds the directed edge list (import + re-export dependencies) once, shared by both
 * the SCC algorithm below and anything else that wants the raw adjacency.
 */
function buildAdjacency(projectMap: ProjectMap): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const module of projectMap.modules) {
    adjacency.set(module.filePath, []);
  }

  for (const module of projectMap.modules) {
    const edges = adjacency.get(module.filePath)!;
    for (const imp of module.imports) {
      if (imp.resolvedPath) edges.push(imp.resolvedPath);
    }
    for (const exp of module.exports) {
      if (exp.reExportResolvedPath) edges.push(exp.reExportResolvedPath);
    }
  }

  return adjacency;
}

/**
 * Tarjan's strongly-connected-components algorithm: finds every group of modules that
 * can all reach each other through some chain of imports. A group with more than one
 * module is a circular dependency — the group itself IS the cycle, since every module
 * in it is reachable from every other.
 */
function findStronglyConnectedComponents(adjacency: Map<string, string[]>): string[][] {
  let nextIndex = 0;
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  function strongConnect(node: string): void {
    index.set(node, nextIndex);
    lowlink.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      if (!index.has(neighbor)) {
        strongConnect(neighbor);
        lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowlink.set(node, Math.min(lowlink.get(node)!, index.get(neighbor)!));
      }
    }

    if (lowlink.get(node) === index.get(node)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      components.push(component);
    }
  }

  for (const node of adjacency.keys()) {
    if (!index.has(node)) strongConnect(node);
  }

  return components;
}

/**
 * Finds circular import dependencies: groups of modules that import each other in a
 * cycle, directly or through intermediaries. These are hard to spot by reading or
 * grepping — a cycle can span many files — which is where a graph algorithm earns
 * its keep over ad hoc exploration.
 */
export function buildCycleData(projectMap: ProjectMap): CycleData {
  const adjacency = buildAdjacency(projectMap);
  const components = findStronglyConnectedComponents(adjacency);

  const cycles = components
    .filter((component) => component.length > 1)
    .map((component) => component.map((filePath) => relativePath(projectMap.rootDir, filePath)).sort());

  return { cycles };
}

/** Renders buildCycleData() as markdown. */
export function generateCycles(projectMap: ProjectMap): string {
  const { cycles } = buildCycleData(projectMap);
  const lines: string[] = ["# Circular Dependencies", ""];

  if (cycles.length === 0) {
    lines.push("No circular dependencies found.");
    return lines.join("\n");
  }

  lines.push(
    `${cycles.length} cycle${cycles.length === 1 ? "" : "s"} found — each group below is a set of ` +
      "modules that all (transitively) import each other:",
    "",
  );

  cycles.forEach((cycle, index) => {
    lines.push(`## Cycle ${index + 1}`, "");
    for (const filePath of cycle) {
      lines.push(`- \`${filePath}\``);
    }
    lines.push("");
  });

  return lines.join("\n");
}
