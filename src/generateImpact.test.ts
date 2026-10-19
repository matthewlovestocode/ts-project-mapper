import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildImpactData, generateImpact } from "./generateImpact.js";
import type { ModuleNode, ProjectMap } from "./types.js";

const rootDir = path.sep === "/" ? "/project" : "C:\\project";
const dbPath = path.join(rootDir, "db.ts");
const repoPath = path.join(rootDir, "repo.ts");
const routeAPath = path.join(rootDir, "routeA.ts");
const routeBPath = path.join(rootDir, "routeB.ts");

function importOf(resolvedPath: string, name: string) {
  return {
    specifier: "./x.js",
    resolvedPath,
    isTypeOnly: false,
    defaultImport: null,
    namespaceImport: null,
    namedImports: [name],
  };
}

function buildFixture(): ProjectMap {
  // db <- repo <- routeA
  //            <- routeB
  const db: ModuleNode = { filePath: dbPath, imports: [], exports: [{ name: "query", isTypeOnly: false }] };
  const repo: ModuleNode = {
    filePath: repoPath,
    imports: [importOf(dbPath, "query")],
    exports: [{ name: "find", isTypeOnly: false }],
  };
  const routeA: ModuleNode = { filePath: routeAPath, imports: [importOf(repoPath, "find")], exports: [] };
  const routeB: ModuleNode = { filePath: routeBPath, imports: [importOf(repoPath, "find")], exports: [] };

  return { rootDir, modules: [db, repo, routeA, routeB] };
}

describe("buildImpactData", () => {
  it("includes direct dependents at depth 1", () => {
    const data = buildImpactData(buildFixture(), dbPath)!;
    const direct = data.affected.filter((m) => m.depth === 1).map((m) => m.relativePath);

    assert.deepEqual(direct, ["repo.ts"]);
  });

  it("includes transitive dependents at depth 2", () => {
    const data = buildImpactData(buildFixture(), dbPath)!;
    const transitive = data.affected.filter((m) => m.depth === 2).map((m) => m.relativePath).sort();

    assert.deepEqual(transitive, ["routeA.ts", "routeB.ts"]);
  });

  it("returns an empty affected list for a leaf nothing depends on", () => {
    const data = buildImpactData(buildFixture(), routeAPath)!;

    assert.deepEqual(data.affected, []);
  });

  it("returns null for a path matching no module", () => {
    const data = buildImpactData(buildFixture(), path.join(rootDir, "missing.ts"));

    assert.equal(data, null);
  });
});

describe("generateImpact", () => {
  it("groups affected modules by hop count", () => {
    const output = generateImpact(buildFixture(), dbPath);

    assert.match(output, /## Direct dependents/);
    assert.match(output, /repo\.ts/);
    assert.match(output, /## 2 hops away/);
    assert.match(output, /routeA\.ts/);
  });

  it("reports nothing affected for a leaf module", () => {
    const output = generateImpact(buildFixture(), routeAPath);

    assert.match(output, /Nothing in this project depends on this module/);
  });
});
