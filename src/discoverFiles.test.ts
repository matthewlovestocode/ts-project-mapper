import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { discoverFiles } from "./discoverFiles.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discover-files-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(relPath: string): void {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "");
}

describe("discoverFiles", () => {
  it("finds .ts and .tsx files recursively", () => {
    write("a.ts");
    write("nested/b.tsx");
    write("nested/deeper/c.ts");

    const found = discoverFiles(tmpDir).map((p) => path.relative(tmpDir, p)).sort();

    assert.deepEqual(found, ["a.ts", "nested/b.tsx", "nested/deeper/c.ts"].sort());
  });

  it("ignores node_modules, dist, .git, build, and out directories", () => {
    write("a.ts");
    write("node_modules/dep/index.ts");
    write("dist/a.ts");
    write(".git/hooks/pre-commit.ts");
    write("build/a.ts");
    write("out/a.ts");

    const found = discoverFiles(tmpDir).map((p) => path.relative(tmpDir, p));

    assert.deepEqual(found, ["a.ts"]);
  });

  it("ignores .d.ts declaration files", () => {
    write("a.ts");
    write("a.d.ts");

    const found = discoverFiles(tmpDir).map((p) => path.relative(tmpDir, p));

    assert.deepEqual(found, ["a.ts"]);
  });

  it("ignores non-TypeScript files", () => {
    write("a.ts");
    write("readme.md");
    write("script.js");

    const found = discoverFiles(tmpDir).map((p) => path.relative(tmpDir, p));

    assert.deepEqual(found, ["a.ts"]);
  });
});
