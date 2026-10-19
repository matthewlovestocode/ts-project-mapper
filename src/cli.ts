#!/usr/bin/env node
import { generateDocs, generateFocus, generateGraph, generateSummary, mapProject } from "./index.js";

// json/markdown/graph each dump the whole project (as data, prose, or a diagram,
// respectively); summary/focus exist to answer narrower questions without paying for
// the full per-module output (see generateDocs.ts).
type Mode = "json" | "markdown" | "summary" | "focus" | "graph";

const args = process.argv.slice(2);
const positional: string[] = [];
let mode: Mode = "json";
let focusTarget: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--focus") {
    // Consumes the next arg as --focus's value, so it isn't also treated as positional.
    focusTarget = args[++i];
    mode = "focus";
  } else if (arg === "--summary") {
    mode = "summary";
  } else if (arg === "--markdown" || arg === "--format=markdown") {
    mode = "markdown";
  } else if (arg === "--graph") {
    mode = "graph";
  } else if (!arg.startsWith("--")) {
    positional.push(arg);
  }
}

// Only positional argument: the directory to scan. Defaults to the current directory.
const rootDir = positional[0] ?? ".";
const projectMap = mapProject(rootDir);

switch (mode) {
  case "summary":
    console.log(generateSummary(projectMap));
    break;
  case "focus":
    if (!focusTarget) {
      console.error("--focus requires a file path");
      process.exit(1);
    }
    console.log(generateFocus(projectMap, focusTarget));
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
