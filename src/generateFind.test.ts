import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildFindData, generateFind } from "./generateFind.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const mathPath = path.join(rootDir, "lib", "math.ts");
const mainPath = path.join(rootDir, "main.ts");
const otherPath = path.join(rootDir, "other.ts");

function buildFixture(): ProjectMap {
  const mathModule: ModuleNode = {
    filePath: mathPath,
    imports: [],
    exports: [{ name: "add", isTypeOnly: false }],
  };

  const mainModule: ModuleNode = {
    filePath: mainPath,
    imports: [
      {
        specifier: "./lib/math.js",
        resolvedPath: mathPath,
        isTypeOnly: false,
        defaultImport: null,
        namespaceImport: null,
        namedImports: ["add"],
      },
      {
        specifier: "zod",
        resolvedPath: null,
        isTypeOnly: false,
        defaultImport: null,
        namespaceImport: null,
        namedImports: [],
      },
    ],
    exports: [],
  };

  const otherModule: ModuleNode = {
    filePath: otherPath,
    imports: [
      {
        specifier: "./lib/math.js",
        resolvedPath: mathPath,
        isTypeOnly: false,
        defaultImport: "math",
        namespaceImport: null,
        namedImports: [],
      },
    ],
    exports: [],
  };

  return { rootDir, modules: [mathModule, mainModule, otherModule] };
}

describe("buildFindData", () => {
  it("finds the module that exports a given name", () => {
    const data = buildFindData(buildFixture(), "add");

    assert.equal(data.definitions.length, 1);
    assert.equal(data.definitions[0].relativePath, "lib/math.ts");
  });

  it("finds every module that imports a name, by import kind", () => {
    const data = buildFindData(buildFixture(), "add");

    assert.equal(data.usages.length, 1);
    assert.equal(data.usages[0].relativePath, "main.ts");
    assert.equal(data.usages[0].kind, "named");
  });

  it("finds a default-import local name", () => {
    const data = buildFindData(buildFixture(), "math");

    assert.equal(data.usages.length, 1);
    assert.equal(data.usages[0].relativePath, "other.ts");
    assert.equal(data.usages[0].kind, "default");
  });

  it("finds an external package specifier", () => {
    const data = buildFindData(buildFixture(), "zod");

    assert.equal(data.usages.length, 1);
    assert.equal(data.usages[0].kind, "external");
  });

  it("returns empty results for a name that doesn't appear anywhere", () => {
    const data = buildFindData(buildFixture(), "nonexistent");

    assert.deepEqual(data.definitions, []);
    assert.deepEqual(data.usages, []);
  });
});

describe("generateFind", () => {
  it("renders a not-found message when nothing matches", () => {
    const output = generateFind(buildFixture(), "nonexistent");

    assert.match(output, /No exports or imports named/);
  });

  it("renders both definitions and usages when found", () => {
    const output = generateFind(buildFixture(), "add");

    assert.match(output, /## Defined in/);
    assert.match(output, /lib\/math\.ts/);
    assert.match(output, /## Imported in/);
    assert.match(output, /main\.ts/);
  });
});
