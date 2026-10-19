import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildUnusedData, generateUnused } from "./generateUnused.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const libPath = path.join(rootDir, "lib.ts");
const mainPath = path.join(rootDir, "main.ts");
const barrelPath = path.join(rootDir, "index.ts");

function namedImport(resolvedPath: string, name: string) {
  return {
    specifier: "./lib.js",
    resolvedPath,
    isTypeOnly: false,
    defaultImport: null,
    namespaceImport: null,
    namedImports: [name],
  };
}

function namespaceImport(resolvedPath: string) {
  return {
    specifier: "./lib.js",
    resolvedPath,
    isTypeOnly: false,
    defaultImport: null,
    namespaceImport: "ns",
    namedImports: [],
  };
}

describe("buildUnusedData", () => {
  it("flags an export nothing imports", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "used", isTypeOnly: false }, { name: "orphan", isTypeOnly: false }],
    };
    const main: ModuleNode = { filePath: mainPath, imports: [namedImport(libPath, "used")], exports: [] };

    const { unused } = buildUnusedData({ rootDir, modules: [lib, main] });

    assert.deepEqual(unused.map((u) => u.name), ["orphan"]);
  });

  it("does not flag an export that's named-imported somewhere", () => {
    const lib: ModuleNode = { filePath: libPath, imports: [], exports: [{ name: "used", isTypeOnly: false }] };
    const main: ModuleNode = { filePath: mainPath, imports: [namedImport(libPath, "used")], exports: [] };

    const { unused } = buildUnusedData({ rootDir, modules: [lib, main] });

    assert.deepEqual(unused, []);
  });

  it("treats a namespace-imported module as fully used", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "a", isTypeOnly: false }, { name: "b", isTypeOnly: false }],
    };
    const main: ModuleNode = { filePath: mainPath, imports: [namespaceImport(libPath)], exports: [] };

    const { unused } = buildUnusedData({ rootDir, modules: [lib, main] });

    assert.deepEqual(unused, []);
  });

  it("treats a wildcard re-export as fully using the source module", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "a", isTypeOnly: false }, { name: "b", isTypeOnly: false }],
    };
    const barrel: ModuleNode = {
      filePath: barrelPath,
      imports: [],
      exports: [{ name: "*", isTypeOnly: false, reExportFrom: "./lib.js", reExportResolvedPath: libPath }],
    };

    const { unused } = buildUnusedData({ rootDir, modules: [lib, barrel] });

    assert.deepEqual(unused, []);
  });

  it("treats a named re-export as using that specific name only", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "a", isTypeOnly: false }, { name: "b", isTypeOnly: false }],
    };
    const barrel: ModuleNode = {
      filePath: barrelPath,
      imports: [],
      exports: [{ name: "a", isTypeOnly: false, reExportFrom: "./lib.js", reExportResolvedPath: libPath }],
    };

    const { unused } = buildUnusedData({ rootDir, modules: [lib, barrel] });

    // lib.ts's "a" is used (forwarded by the barrel), so only lib.ts's "b" is flagged on
    // lib.ts itself — but the barrel's own forwarded "a" is separately unused, since
    // nothing imports "a" from the barrel either.
    const unusedInLib = unused.filter((u) => u.relativePath === "lib.ts").map((u) => u.name);
    assert.deepEqual(unusedInLib, ["b"]);
  });
});

describe("generateUnused", () => {
  it("reports no unused exports when there are none", () => {
    const lib: ModuleNode = { filePath: libPath, imports: [], exports: [] };
    const output = generateUnused({ rootDir, modules: [lib] });

    assert.match(output, /No unused exports found/);
  });

  it("lists each unused export with its file", () => {
    const lib: ModuleNode = { filePath: libPath, imports: [], exports: [{ name: "orphan", isTypeOnly: false }] };
    const output = generateUnused({ rootDir, modules: [lib] });

    assert.match(output, /`orphan`/);
    assert.match(output, /lib\.ts/);
  });
});
