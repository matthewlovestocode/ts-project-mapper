import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { generateDocs, generateFocus, generateSummary } from "./generateDocs.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const mathPath = path.join(rootDir, "lib", "math.ts");
const mainPath = path.join(rootDir, "main.ts");

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
        namedImports: ["z"],
      },
    ],
    exports: [],
  };

  return { rootDir, modules: [mathModule, mainModule] };
}

describe("generateSummary", () => {
  it("lists external dependencies and entry points without per-module detail", () => {
    const summary = generateSummary(buildFixture());

    assert.match(summary, /`zod`/);
    assert.match(summary, /main\.ts/);
    assert.doesNotMatch(summary, /## Modules/);
  });

  it("does not list math.ts as an entry point since main.ts depends on it", () => {
    const summary = generateSummary(buildFixture());
    const entryPointsSection = summary.split("## Likely Entry Points")[1] ?? "";

    assert.doesNotMatch(entryPointsSection, /lib\/math\.ts/);
  });
});

describe("generateFocus", () => {
  it("reports a module's own exports and its dependents with the names they import", () => {
    const focus = generateFocus(buildFixture(), mathPath);

    assert.match(focus, /\*\*Exports:\*\* `add`/);
    assert.match(focus, /main\.ts.*\(add\)/);
  });

  it("reports no dependents for a module nothing imports", () => {
    const focus = generateFocus(buildFixture(), mainPath);

    assert.match(focus, /nothing in this project/);
  });

  it("returns a not-found message for a path matching no module", () => {
    const focus = generateFocus(buildFixture(), path.join(rootDir, "missing.ts"));

    assert.match(focus, /No module found/);
  });
});

describe("generateDocs", () => {
  it("includes a per-module section for every module", () => {
    const docs = generateDocs(buildFixture());

    assert.match(docs, /### `lib\/math\.ts`/);
    assert.match(docs, /### `main\.ts`/);
  });
});
