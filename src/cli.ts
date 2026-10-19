#!/usr/bin/env node
import { generateDocs, generateFocus, generateSummary, mapProject } from "./index.js";

type Mode = "json" | "markdown" | "summary" | "focus";

const args = process.argv.slice(2);
const positional: string[] = [];
let mode: Mode = "json";
let focusTarget: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--focus") {
    focusTarget = args[++i];
    mode = "focus";
  } else if (arg === "--summary") {
    mode = "summary";
  } else if (arg === "--markdown" || arg === "--format=markdown") {
    mode = "markdown";
  } else if (!arg.startsWith("--")) {
    positional.push(arg);
  }
}

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
  default:
    console.log(JSON.stringify(projectMap, null, 2));
}
