import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildMissingDocsData, generateMissingDocs } from "./generateMissingDocs.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const libPath = path.join(rootDir, "lib.ts");

describe("buildMissingDocsData", () => {
  it("flags an export with hasJsDoc false", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "undocumented", isTypeOnly: false, hasJsDoc: false }],
    };

    const { missing } = buildMissingDocsData({ rootDir, modules: [lib] });

    assert.deepEqual(missing.map((m) => m.name), ["undocumented"]);
  });

  it("does not flag an export with hasJsDoc true", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "documented", isTypeOnly: false, hasJsDoc: true }],
    };

    const { missing } = buildMissingDocsData({ rootDir, modules: [lib] });

    assert.deepEqual(missing, []);
  });

  it("does not flag a re-export, where hasJsDoc is undefined", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "x", isTypeOnly: false, reExportFrom: "./y.js", reExportResolvedPath: null }],
    };

    const { missing } = buildMissingDocsData({ rootDir, modules: [lib] });

    assert.deepEqual(missing, []);
  });
});

describe("generateMissingDocs", () => {
  it("reports all-documented when nothing is missing", () => {
    const lib: ModuleNode = { filePath: libPath, imports: [], exports: [] };
    const output = generateMissingDocs({ rootDir, modules: [lib] });

    assert.match(output, /Every exported declaration has a JSDoc comment/);
  });

  it("lists each undocumented export with its file", () => {
    const lib: ModuleNode = {
      filePath: libPath,
      imports: [],
      exports: [{ name: "undocumented", isTypeOnly: false, hasJsDoc: false }],
    };
    const output = generateMissingDocs({ rootDir, modules: [lib] });

    assert.match(output, /`undocumented`/);
    assert.match(output, /lib\.ts/);
  });
});
