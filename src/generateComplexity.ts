import { analyzeComplexity } from "./analyzeComplexity.js";
import type { FunctionComplexity } from "./analyzeComplexity.js";
import { relativePath } from "./graphUtils.js";
import type { ProjectMap } from "./types.js";

/** One source file's size metrics, with its path resolved relative to the project root. */
export interface FileComplexityReport {
  filePath: string;
  relativePath: string;
  lineCount: number;
  topLevelDeclarationCount: number;
  functions: FunctionComplexity[];
}

/** Plain-data shape behind generateComplexity(): unflagged metrics for every file in the project. */
export interface ComplexityData {
  files: FileComplexityReport[];
}

/** Cutoffs generateComplexity() uses to decide what's worth flagging. */
export interface ComplexityThresholds {
  maxFunctionLines: number;
  maxCyclomaticComplexity: number;
  maxFileDeclarations: number;
}

/**
 * Starting points, not hard rules — long/branchy is relative to a codebase's own style.
 * Pass a different ComplexityThresholds to generateComplexity() to tune them.
 */
export const DEFAULT_COMPLEXITY_THRESHOLDS: ComplexityThresholds = {
  maxFunctionLines: 50,
  maxCyclomaticComplexity: 10,
  maxFileDeclarations: 15,
};

/**
 * Computes size/complexity metrics for every function and file in the project. Raw and
 * unopinionated — no thresholds applied — so JSON consumers can apply their own cutoffs
 * rather than inheriting generateComplexity()'s defaults.
 */
export function buildComplexityData(projectMap: ProjectMap): ComplexityData {
  const { rootDir, modules } = projectMap;

  const files = modules.map((module) => {
    const report = analyzeComplexity(module.filePath);
    return { ...report, relativePath: relativePath(rootDir, module.filePath) };
  });

  return { files };
}

/**
 * Renders buildComplexityData() as markdown, applying `thresholds` to decide what's worth
 * flagging. Files are flagged on declaration count, not line count — a long file made of
 * many small, clean functions is a different (and often fine) situation from a short file
 * with one sprawling function, and only the per-function metrics distinguish them.
 */
export function generateComplexity(
  projectMap: ProjectMap,
  thresholds: ComplexityThresholds = DEFAULT_COMPLEXITY_THRESHOLDS,
): string {
  const { files } = buildComplexityData(projectMap);
  const lines: string[] = ["# Complexity", ""];

  const flaggedFiles = files.filter((file) => file.topLevelDeclarationCount > thresholds.maxFileDeclarations);
  const flaggedFunctions = files.flatMap((file) =>
    file.functions
      .filter(
        (fn) =>
          fn.lineCount > thresholds.maxFunctionLines || fn.cyclomaticComplexity > thresholds.maxCyclomaticComplexity,
      )
      .map((fn) => ({ ...fn, relativePath: file.relativePath })),
  );

  if (flaggedFiles.length === 0 && flaggedFunctions.length === 0) {
    lines.push("No files or functions exceed the complexity thresholds.");
    return lines.join("\n");
  }

  if (flaggedFiles.length > 0) {
    lines.push(
      `## Files with many top-level declarations (> ${thresholds.maxFileDeclarations})`,
      "",
      "_A lot of top-level declarations in one file, exported or not — a possible sign the " +
        "file is doing more than one job, even if no single function is large._",
      "",
    );
    for (const file of flaggedFiles) {
      lines.push(`- \`${file.relativePath}\` — ${file.topLevelDeclarationCount} declarations`);
    }
    lines.push("");
  }

  if (flaggedFunctions.length > 0) {
    lines.push(
      `## Long or branchy functions (> ${thresholds.maxFunctionLines} lines, or complexity > ${thresholds.maxCyclomaticComplexity})`,
      "",
    );
    for (const fn of flaggedFunctions) {
      lines.push(
        `- \`${fn.name}\` in \`${fn.relativePath}:${fn.startLine}\` — ${fn.lineCount} lines, ` +
          `complexity ${fn.cyclomaticComplexity}, ${fn.parameterCount} param${fn.parameterCount === 1 ? "" : "s"}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
