import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { analyzeComplexity } from "./analyzeComplexity.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "analyze-complexity-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeAndAnalyze(source: string) {
  const filePath = path.join(tmpDir, "a.ts");
  fs.writeFileSync(filePath, source);
  return analyzeComplexity(filePath);
}

describe("analyzeComplexity", () => {
  it("gives a straight-line function baseline complexity 1", () => {
    const { functions } = writeAndAnalyze(`function foo() { return 1; }`);

    assert.equal(functions[0].cyclomaticComplexity, 1);
  });

  it("counts each decision point toward complexity", () => {
    const { functions } = writeAndAnalyze(`
      function foo(x) {
        if (x > 0) {
          return "positive";
        } else if (x < 0) {
          return "negative";
        }
        for (let i = 0; i < x; i++) {}
        return x ? "truthy" : "falsy";
      }
    `);

    // baseline 1 + two ifs + one for + one ternary = 5
    assert.equal(functions[0].cyclomaticComplexity, 5);
  });

  it("counts short-circuit operators toward complexity", () => {
    const { functions } = writeAndAnalyze(`function foo(a, b) { return a && b || a ?? b; }`);

    // baseline 1 + && + || + ?? = 4
    assert.equal(functions[0].cyclomaticComplexity, 4);
  });

  it("measures a nested function separately from its enclosing function", () => {
    const { functions } = writeAndAnalyze(`
      function outer() {
        if (true) {}
        function inner() {
          if (true) {}
          if (true) {}
        }
      }
    `);

    const outer = functions.find((f) => f.name === "outer")!;
    const inner = functions.find((f) => f.name === "inner")!;

    assert.equal(outer.cyclomaticComplexity, 2); // baseline + its own one if
    assert.equal(inner.cyclomaticComplexity, 3); // baseline + its own two ifs
  });

  it("names a method with its enclosing class", () => {
    const { functions } = writeAndAnalyze(`class Foo { bar() { return 1; } }`);

    assert.equal(functions[0].name, "Foo.bar");
  });

  it("names an arrow function from the variable it's assigned to", () => {
    const { functions } = writeAndAnalyze(`const double = (x) => x * 2;`);

    assert.equal(functions[0].name, "double");
  });

  it("falls back to <anonymous> for a function with no inferrable name", () => {
    const { functions } = writeAndAnalyze(`[1, 2, 3].map(function (x) { return x; });`);

    assert.equal(functions[0].name, "<anonymous>");
  });

  it("counts parameters", () => {
    const { functions } = writeAndAnalyze(`function foo(a, b, c) {}`);

    assert.equal(functions[0].parameterCount, 3);
  });

  it("tracks max nesting depth of control-flow blocks", () => {
    const { functions } = writeAndAnalyze(`
      function foo() {
        if (true) {
          if (true) {
            if (true) {}
          }
        }
      }
    `);

    assert.equal(functions[0].maxNestingDepth, 3);
  });

  it("counts top-level declarations, exported or not", () => {
    const { topLevelDeclarationCount } = writeAndAnalyze(`
      function a() {}
      function b() {}
      const c = 1;
      export class D {}
    `);

    assert.equal(topLevelDeclarationCount, 4);
  });

  it("counts total file lines", () => {
    const { lineCount } = writeAndAnalyze("line1\nline2\nline3");

    assert.equal(lineCount, 3);
  });
});
