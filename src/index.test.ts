import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mapProject } from "./index.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "map-project-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(relPath: string, content: string): void {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe("mapProject", () => {
  it("builds a module graph across a directory with relative imports", () => {
    write("src/lib/math.ts", "export function add(a: number, b: number) { return a + b; }");
    write("src/main.ts", 'import { add } from "./lib/math.js";\nconsole.log(add(1, 2));');

    const projectMap = mapProject(path.join(tmpDir, "src"));

    assert.equal(projectMap.modules.length, 2);
    const main = projectMap.modules.find((m) => m.filePath.endsWith("main.ts"));
    assert.equal(main?.imports[0]?.resolvedPath, path.join(tmpDir, "src", "lib", "math.ts"));
  });

  it("resolves tsconfig path aliases found above the analyzed directory", () => {
    write(
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
    );
    write("src/lib/math.ts", "export function add(a: number, b: number) { return a + b; }");
    write("src/main.ts", 'import { add } from "@/lib/math";\nconsole.log(add(1, 2));');

    const projectMap = mapProject(path.join(tmpDir, "src"));

    const main = projectMap.modules.find((m) => m.filePath.endsWith("main.ts"));
    assert.equal(main?.imports[0]?.resolvedPath, path.join(tmpDir, "src", "lib", "math.ts"));
  });

  it("treats an unresolvable bare specifier as external when no tsconfig is present", () => {
    write("src/main.ts", 'import { z } from "zod";');

    const projectMap = mapProject(path.join(tmpDir, "src"));

    const main = projectMap.modules.find((m) => m.filePath.endsWith("main.ts"));
    assert.equal(main?.imports[0]?.resolvedPath, null);
  });
});
