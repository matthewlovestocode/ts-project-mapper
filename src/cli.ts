#!/usr/bin/env node
import { generateDocs, mapProject } from "./index.js";

const args = process.argv.slice(2);
const useMarkdown = args.includes("--markdown") || args.includes("--format=markdown");
const rootDir = args.find((arg) => !arg.startsWith("--")) ?? ".";

const projectMap = mapProject(rootDir);

console.log(useMarkdown ? generateDocs(projectMap) : JSON.stringify(projectMap, null, 2));
