import { relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/**
 * Renders the project's internal dependency graph as a Mermaid flowchart, fenced in a
 * ```mermaid code block so it renders inline on GitHub, VS Code's markdown preview, and
 * most other markdown viewers without any extra tooling.
 *
 * Only internal modules become nodes — external packages are already covered by
 * generateSummary()'s dependency list, and including them here would add a lot of
 * nodes for little benefit. Direct imports are drawn as solid arrows; re-exports
 * (`export ... from`) are drawn dashed, since they're a real dependency but a
 * different kind of one.
 */
export function generateGraph(projectMap: ProjectMap): string {
  const { rootDir, modules } = projectMap;

  // Mermaid node IDs can't contain slashes/dots, so map each file to a plain n0, n1, ...
  // and keep the real relative path as the node's display label instead.
  const idByPath = new Map<string, string>();
  modules.forEach((module, index) => idByPath.set(module.filePath, `n${index}`));

  const lines: string[] = ["```mermaid", "flowchart LR"];

  for (const module of modules) {
    const id = idByPath.get(module.filePath)!;
    const label = relativePath(rootDir, module.filePath);
    lines.push(`    ${id}["${label}"]`);
  }

  const seenEdges = new Set<string>();

  function addEdge(fromPath: string, toPath: string, style: "solid" | "dashed"): void {
    const fromId = idByPath.get(fromPath);
    const toId = idByPath.get(toPath);
    if (!fromId || !toId) return;

    // Same pair can show up more than once (e.g. two named imports from the same file);
    // dedupe per style so the diagram doesn't draw redundant parallel edges.
    const key = `${fromId}->${toId}->${style}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);

    lines.push(style === "solid" ? `    ${fromId} --> ${toId}` : `    ${fromId} -.-> ${toId}`);
  }

  for (const module of modules) {
    for (const imp of module.imports) {
      if (imp.resolvedPath) addEdge(module.filePath, imp.resolvedPath, "solid");
    }
    for (const exp of module.exports) {
      if (exp.reExportResolvedPath) addEdge(module.filePath, exp.reExportResolvedPath, "dashed");
    }
  }

  lines.push("```");

  return lines.join("\n");
}
