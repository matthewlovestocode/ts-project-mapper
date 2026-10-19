import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resolveImport } from "./resolveImport.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resolve-import-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveImport", () => {
  it("resolves a relative specifier to an existing .ts file", () => {
    fs.writeFileSync(path.join(tmpDir, "bar.ts"), "export const bar = 1;");
    const fromFile = path.join(tmpDir, "foo.ts");

    assert.equal(resolveImport("./bar", fromFile), path.join(tmpDir, "bar.ts"));
  });

  it("strips a compiled .js extension and resolves the .ts source", () => {
    fs.writeFileSync(path.join(tmpDir, "bar.ts"), "export const bar = 1;");
    const fromFile = path.join(tmpDir, "foo.ts");

    assert.equal(resolveImport("./bar.js", fromFile), path.join(tmpDir, "bar.ts"));
  });

  it("resolves a directory import to its index.ts", () => {
    fs.mkdirSync(path.join(tmpDir, "nested"));
    fs.writeFileSync(path.join(tmpDir, "nested", "index.ts"), "export const nested = 1;");
    const fromFile = path.join(tmpDir, "foo.ts");

    assert.equal(resolveImport("./nested", fromFile), path.join(tmpDir, "nested", "index.ts"));
  });

  it("returns null for a bare external package specifier with no alias config", () => {
    const fromFile = path.join(tmpDir, "foo.ts");
    assert.equal(resolveImport("lodash", fromFile), null);
  });

  it("returns null for a relative specifier that doesn't resolve to any file", () => {
    const fromFile = path.join(tmpDir, "foo.ts");
    assert.equal(resolveImport("./missing", fromFile), null);
  });

  it("resolves a wildcard path alias against baseDir", () => {
    fs.mkdirSync(path.join(tmpDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "lib", "math.ts"), "export const add = 1;");
    const fromFile = path.join(tmpDir, "src", "main.ts");
    const aliasConfig = { baseDir: tmpDir, paths: { "@/*": ["src/*"] } };

    assert.equal(
      resolveImport("@/lib/math", fromFile, aliasConfig),
      path.join(tmpDir, "src", "lib", "math.ts"),
    );
  });

  it("prefers the alias pattern with the longest literal prefix", () => {
    fs.mkdirSync(path.join(tmpDir, "special"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "general"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "special", "widget.ts"), "export const widget = 1;");
    fs.writeFileSync(path.join(tmpDir, "general", "widget.ts"), "export const widget = 2;");
    const fromFile = path.join(tmpDir, "main.ts");
    const aliasConfig = {
      baseDir: tmpDir,
      paths: {
        "@/*": ["general/*"],
        "@/special/*": ["special/*"],
      },
    };

    assert.equal(
      resolveImport("@/special/widget", fromFile, aliasConfig),
      path.join(tmpDir, "special", "widget.ts"),
    );
  });

  it("returns null when an alias pattern matches but no target file exists", () => {
    const fromFile = path.join(tmpDir, "main.ts");
    const aliasConfig = { baseDir: tmpDir, paths: { "@/*": ["src/*"] } };

    assert.equal(resolveImport("@/missing", fromFile, aliasConfig), null);
  });
});
