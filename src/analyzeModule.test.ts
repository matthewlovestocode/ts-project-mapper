import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { analyzeModule } from "./analyzeModule.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "analyze-module-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeAndAnalyze(fileName: string, source: string) {
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, source);
  return analyzeModule(filePath);
}

describe("analyzeModule imports", () => {
  it("parses default, named, aliased, and namespace imports from one declaration", () => {
    const { imports } = writeAndAnalyze(
      "a.ts",
      `import def, { a, b as c } from "./x";\nimport * as ns from "./y";`,
    );

    assert.equal(imports.length, 2);
    assert.equal(imports[0].defaultImport, "def");
    assert.deepEqual(imports[0].namedImports, ["a", "b"]);
    assert.equal(imports[1].namespaceImport, "ns");
  });

  it("flags type-only imports", () => {
    const { imports } = writeAndAnalyze("a.ts", `import type { Foo } from "./x";`);

    assert.equal(imports[0].isTypeOnly, true);
    assert.deepEqual(imports[0].namedImports, ["Foo"]);
  });

  it("records a side-effect-only import with no bindings", () => {
    const { imports } = writeAndAnalyze("a.ts", `import "./polyfill";`);

    assert.equal(imports[0].defaultImport, null);
    assert.equal(imports[0].namespaceImport, null);
    assert.deepEqual(imports[0].namedImports, []);
  });

  it("resolves a relative import to its sibling file", () => {
    fs.writeFileSync(path.join(tmpDir, "x.ts"), "export const x = 1;");
    const { imports } = writeAndAnalyze("a.ts", `import { x } from "./x.js";`);

    assert.equal(imports[0].resolvedPath, path.join(tmpDir, "x.ts"));
  });

  it("leaves an external package specifier unresolved", () => {
    const { imports } = writeAndAnalyze("a.ts", `import { z } from "zod";`);

    assert.equal(imports[0].resolvedPath, null);
    assert.equal(imports[0].specifier, "zod");
  });
});

describe("analyzeModule exports", () => {
  it("records named declaration exports", () => {
    const { exports } = writeAndAnalyze(
      "a.ts",
      `export function foo() {}\nexport class Bar {}\nexport const baz = 1;`,
    );

    const names = exports.map((e) => e.name).sort();
    assert.deepEqual(names, ["Bar", "baz", "foo"]);
  });

  it("marks interfaces and type aliases as type-only exports", () => {
    const { exports } = writeAndAnalyze(
      "a.ts",
      `export interface Foo {}\nexport type Bar = string;\nexport enum Baz { A }`,
    );

    const byName = new Map(exports.map((e) => [e.name, e.isTypeOnly]));
    assert.equal(byName.get("Foo"), true);
    assert.equal(byName.get("Bar"), true);
    assert.equal(byName.get("Baz"), false);
  });

  it("records a default export via export assignment", () => {
    const { exports } = writeAndAnalyze("a.ts", `export default function foo() {}`);

    assert.deepEqual(exports, [{ name: "default", isTypeOnly: false }]);
  });

  it("records named re-exports and resolves the source file", () => {
    fs.writeFileSync(path.join(tmpDir, "x.ts"), "export const x = 1;");
    const { exports } = writeAndAnalyze("a.ts", `export { x } from "./x.js";`);

    assert.equal(exports[0].name, "x");
    assert.equal(exports[0].reExportFrom, "./x.js");
    assert.equal(exports[0].reExportResolvedPath, path.join(tmpDir, "x.ts"));
  });

  it("records a wildcard re-export", () => {
    fs.writeFileSync(path.join(tmpDir, "x.ts"), "export const x = 1;");
    const { exports } = writeAndAnalyze("a.ts", `export * from "./x.js";`);

    assert.equal(exports[0].name, "*");
    assert.equal(exports[0].reExportResolvedPath, path.join(tmpDir, "x.ts"));
  });

  it("records a namespace re-export", () => {
    fs.writeFileSync(path.join(tmpDir, "x.ts"), "export const x = 1;");
    const { exports } = writeAndAnalyze("a.ts", `export * as ns from "./x.js";`);

    assert.equal(exports[0].name, "ns");
    assert.equal(exports[0].reExportResolvedPath, path.join(tmpDir, "x.ts"));
  });
});
