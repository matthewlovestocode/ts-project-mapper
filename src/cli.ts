#!/usr/bin/env node
import {
  buildComplexityData,
  buildCycleData,
  buildFindData,
  buildFocusData,
  buildImpactData,
  buildMissingDocsData,
  buildSummaryData,
  buildUnusedData,
  generateComplexity,
  generateCycles,
  generateDocs,
  generateFind,
  generateFocus,
  generateGraph,
  generateImpact,
  generateMissingDocs,
  generateSummary,
  generateUnused,
  mapProject,
} from "./index.js";

// json/markdown/graph each dump the whole project (as data, prose, or a diagram,
// respectively); the rest answer narrower questions without paying for the full
// per-module output (see generateDocs.ts).
type Mode =
  | "json"
  | "markdown"
  | "summary"
  | "focus"
  | "graph"
  | "find"
  | "impact"
  | "cycles"
  | "unused"
  | "missing-docs"
  | "complexity";

const args = process.argv.slice(2);
const positional: string[] = [];
let mode: Mode = "json";
let asJson = false;
let focusTarget: string | undefined;
let findQuery: string | undefined;
let impactTarget: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--focus") {
    // Consumes the next arg as the flag's value, so it isn't also treated as positional.
    focusTarget = args[++i];
    mode = "focus";
  } else if (arg === "--find") {
    findQuery = args[++i];
    mode = "find";
  } else if (arg === "--impact") {
    impactTarget = args[++i];
    mode = "impact";
  } else if (arg === "--summary") {
    mode = "summary";
  } else if (arg === "--cycles") {
    mode = "cycles";
  } else if (arg === "--unused") {
    mode = "unused";
  } else if (arg === "--missing-docs") {
    mode = "missing-docs";
  } else if (arg === "--complexity") {
    mode = "complexity";
  } else if (arg === "--markdown" || arg === "--format=markdown") {
    mode = "markdown";
  } else if (arg === "--graph") {
    mode = "graph";
  } else if (arg === "--json") {
    asJson = true;
  } else if (!arg.startsWith("--")) {
    positional.push(arg);
  }
}

// Only positional argument: the directory to scan. Defaults to the current directory.
const rootDir = positional[0] ?? ".";
const projectMap = mapProject(rootDir);

function requireArg(value: string | undefined, flag: string): string {
  if (!value) {
    console.error(`${flag} requires a value`);
    // process.exit()'s `never` return type is what lets TS narrow `value` to
    // `string` below, without needing an explicit return/throw in this branch.
    process.exit(1);
  }
  return value;
}

switch (mode) {
  case "summary":
    console.log(asJson ? JSON.stringify(buildSummaryData(projectMap), null, 2) : generateSummary(projectMap));
    break;
  case "focus": {
    const target = requireArg(focusTarget, "--focus");
    console.log(
      asJson ? JSON.stringify(buildFocusData(projectMap, target), null, 2) : generateFocus(projectMap, target),
    );
    break;
  }
  case "find": {
    const query = requireArg(findQuery, "--find");
    console.log(asJson ? JSON.stringify(buildFindData(projectMap, query), null, 2) : generateFind(projectMap, query));
    break;
  }
  case "impact": {
    const target = requireArg(impactTarget, "--impact");
    console.log(
      asJson ? JSON.stringify(buildImpactData(projectMap, target), null, 2) : generateImpact(projectMap, target),
    );
    break;
  }
  case "cycles":
    console.log(asJson ? JSON.stringify(buildCycleData(projectMap), null, 2) : generateCycles(projectMap));
    break;
  case "unused":
    console.log(asJson ? JSON.stringify(buildUnusedData(projectMap), null, 2) : generateUnused(projectMap));
    break;
  case "missing-docs":
    console.log(
      asJson ? JSON.stringify(buildMissingDocsData(projectMap), null, 2) : generateMissingDocs(projectMap),
    );
    break;
  case "complexity":
    console.log(asJson ? JSON.stringify(buildComplexityData(projectMap), null, 2) : generateComplexity(projectMap));
    break;
  case "markdown":
    console.log(generateDocs(projectMap));
    break;
  case "graph":
    console.log(generateGraph(projectMap));
    break;
  default:
    console.log(JSON.stringify(projectMap, null, 2));
}
