#!/usr/bin/env node
import { mapProject } from "./index.js";

const [rootDir = "."] = process.argv.slice(2);

const projectMap = mapProject(rootDir);
console.log(JSON.stringify(projectMap, null, 2));
