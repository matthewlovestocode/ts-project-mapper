import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildCycleData, generateCycles } from "./generateCycles.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const aPath = path.join(rootDir, "a.ts");
const bPath = path.join(rootDir, "b.ts");
const cPath = path.join(rootDir, "c.ts");

function importOf(resolvedPath: string) {
  return {
    specifier: "./x.js",
    resolvedPath,
    isTypeOnly: false,
    defaultImport: null,
    namespaceImport: null,
    namedImports: ["x"],
  };
}

describe("buildCycleData", () => {
  it("finds no cycles in a linear dependency chain", () => {
    const a: ModuleNode = { filePath: aPath, imports: [], exports: [] };
    const b: ModuleNode = { filePath: bPath, imports: [importOf(aPath)], exports: [] };
    const c: ModuleNode = { filePath: cPath, imports: [importOf(bPath)], exports: [] };
    const projectMap: ProjectMap = { rootDir, modules: [a, b, c] };

    assert.deepEqual(buildCycleData(projectMap).cycles, []);
  });

  it("finds a two-module cycle", () => {
    const a: ModuleNode = { filePath: aPath, imports: [importOf(bPath)], exports: [] };
    const b: ModuleNode = { filePath: bPath, imports: [importOf(aPath)], exports: [] };
    const projectMap: ProjectMap = { rootDir, modules: [a, b] };

    const { cycles } = buildCycleData(projectMap);
    assert.equal(cycles.length, 1);
    assert.deepEqual(cycles[0], ["a.ts", "b.ts"]);
  });

  it("finds a three-module cycle through intermediaries", () => {
    const a: ModuleNode = { filePath: aPath, imports: [importOf(bPath)], exports: [] };
    const b: ModuleNode = { filePath: bPath, imports: [importOf(cPath)], exports: [] };
    const c: ModuleNode = { filePath: cPath, imports: [importOf(aPath)], exports: [] };
    const projectMap: ProjectMap = { rootDir, modules: [a, b, c] };

    const { cycles } = buildCycleData(projectMap);
    assert.equal(cycles.length, 1);
    assert.deepEqual(cycles[0], ["a.ts", "b.ts", "c.ts"]);
  });

  it("detects a cycle formed through a re-export edge", () => {
    const a: ModuleNode = {
      filePath: aPath,
      imports: [importOf(bPath)],
      exports: [{ name: "x", isTypeOnly: false, reExportFrom: "./a.js", reExportResolvedPath: aPath }],
    };
    const b: ModuleNode = {
      filePath: bPath,
      imports: [],
      exports: [{ name: "x", isTypeOnly: false, reExportFrom: "./a.js", reExportResolvedPath: aPath }],
    };
    const projectMap: ProjectMap = { rootDir, modules: [a, b] };

    const { cycles } = buildCycleData(projectMap);
    assert.equal(cycles.length, 1);
    assert.deepEqual(cycles[0], ["a.ts", "b.ts"]);
  });
});

describe("generateCycles", () => {
  it("reports no cycles found for an acyclic project", () => {
    const a: ModuleNode = { filePath: aPath, imports: [], exports: [] };
    const output = generateCycles({ rootDir, modules: [a] });

    assert.match(output, /No circular dependencies found/);
  });

  it("lists each cycle's modules", () => {
    const a: ModuleNode = { filePath: aPath, imports: [importOf(bPath)], exports: [] };
    const b: ModuleNode = { filePath: bPath, imports: [importOf(aPath)], exports: [] };
    const output = generateCycles({ rootDir, modules: [a, b] });

    assert.match(output, /## Cycle 1/);
    assert.match(output, /a\.ts/);
    assert.match(output, /b\.ts/);
  });
});
