import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildComplexityData, generateComplexity } from "./generateComplexity.js";
import type { ModuleNode, ProjectMap } from "./types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "generate-complexity-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function fixtureWith(source: string): ProjectMap {
  const filePath = path.join(tmpDir, "a.ts");
  fs.writeFileSync(filePath, source);
  const module: ModuleNode = { filePath, imports: [], exports: [] };
  return { rootDir: tmpDir, modules: [module] };
}

describe("buildComplexityData", () => {
  it("returns raw per-file metrics with a relative path", () => {
    const data = buildComplexityData(fixtureWith("function foo() {}"));

    assert.equal(data.files[0].relativePath, "a.ts");
    assert.equal(data.files[0].functions[0].name, "foo");
  });
});

describe("generateComplexity", () => {
  it("reports nothing flagged for a small, simple file", () => {
    const output = generateComplexity(fixtureWith("function foo() { return 1; }"));

    assert.match(output, /No files or functions exceed the complexity thresholds/);
  });

  it("flags a function exceeding the line threshold", () => {
    const body = Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join("\n");
    const output = generateComplexity(fixtureWith(`function big() {\n${body}\n}`));

    assert.match(output, /Long or branchy functions/);
    assert.match(output, /`big`/);
  });

  it("flags a function exceeding the complexity threshold", () => {
    const ifs = Array.from({ length: 11 }, (_, i) => `if (x === ${i}) {}`).join("\n");
    const output = generateComplexity(fixtureWith(`function branchy(x) {\n${ifs}\n}`));

    assert.match(output, /Long or branchy functions/);
    assert.match(output, /`branchy`/);
  });

  it("flags a file exceeding the declaration-count threshold", () => {
    const declarations = Array.from({ length: 16 }, (_, i) => `function f${i}() {}`).join("\n");
    const output = generateComplexity(fixtureWith(declarations));

    assert.match(output, /Files with many top-level declarations/);
  });

  it("respects custom thresholds", () => {
    const output = generateComplexity(fixtureWith("function foo() { return 1; }"), {
      maxFunctionLines: 0,
      maxCyclomaticComplexity: 10,
      maxFileDeclarations: 15,
    });

    assert.match(output, /Long or branchy functions/);
    assert.match(output, /`foo`/);
  });
});
