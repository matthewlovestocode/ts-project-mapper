import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { generateGraph } from "./generateGraph.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const mathPath = path.join(rootDir, "lib", "math.ts");
const mainPath = path.join(rootDir, "main.ts");
const barrelPath = path.join(rootDir, "index.ts");

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

  const barrelModule: ModuleNode = {
    filePath: barrelPath,
    imports: [],
    exports: [{ name: "add", isTypeOnly: false, reExportFrom: "./lib/math.js", reExportResolvedPath: mathPath }],
  };

  return { rootDir, modules: [mathModule, mainModule, barrelModule] };
}

describe("generateGraph", () => {
  it("fences the output as a mermaid code block", () => {
    const graph = generateGraph(buildFixture());

    assert.match(graph, /^```mermaid\n/);
    assert.match(graph, /\n```$/);
  });

  it("includes a node for every internal module, labeled by relative path", () => {
    const graph = generateGraph(buildFixture());

    assert.match(graph, /\["lib\/math\.ts"\]/);
    assert.match(graph, /\["main\.ts"\]/);
    assert.match(graph, /\["index\.ts"\]/);
  });

  it("does not create a node for an external package", () => {
    const graph = generateGraph(buildFixture());

    assert.doesNotMatch(graph, /zod/);
  });

  it("draws a solid edge for a direct import", () => {
    const graph = generateGraph(buildFixture());
    const mainId = graph.match(/(n\d+)\["main\.ts"\]/)?.[1];
    const mathId = graph.match(/(n\d+)\["lib\/math\.ts"\]/)?.[1];

    assert.ok(mainId && mathId);
    assert.match(graph, new RegExp(`${mainId} --> ${mathId}`));
  });

  it("draws a dashed edge for a re-export", () => {
    const graph = generateGraph(buildFixture());
    const barrelId = graph.match(/(n\d+)\["index\.ts"\]/)?.[1];
    const mathId = graph.match(/(n\d+)\["lib\/math\.ts"\]/)?.[1];

    assert.ok(barrelId && mathId);
    assert.match(graph, new RegExp(`${barrelId} -\\.-> ${mathId}`));
  });
});
