# ts-project-mapper

Maps a TypeScript project's imports and exports into a dependency graph, and generates
documentation and diagrams from it — sized for either a human skimming a repo or an AI
agent orienting itself before diving into source files.

Parses source with the TypeScript Compiler API, resolves relative imports and tsconfig
`paths` aliases to real files on disk, and distinguishes runtime imports/exports from
`type`-only ones.

## Install

```sh
npm install @matthewlovestocode/ts-project-mapper
```

## CLI

```sh
npx ts-project-mapper <dir> [mode] [--json]
```

| Mode | What it does |
| --- | --- |
| _(none)_ | Full `ProjectMap` as JSON |
| `--markdown` | Full map as markdown: external deps, entry points, every module's exports/imports/dependents |
| `--summary` | Just the overview — module count, external deps, likely entry points. Cheap, bounded size; the right first call on an unfamiliar project |
| `--focus <file>` | One module's own exports/imports, plus every dependent and which names each imports from it |
| `--graph` | The internal dependency graph as a fenced ` ```mermaid ` flowchart — renders inline on GitHub, VS Code's markdown preview, etc. |
| `--find <name>` | Where a name is defined (which module exports it) and everywhere it's imported — the starting point when you have a symbol name but not a file path |
| `--impact <file>` | The full transitive "blast radius" of a module: everything that depends on it, directly or through a chain of dependents |
| `--cycles` | Circular dependencies — groups of modules that (transitively) import each other |
| `--unused` | Exports nothing in the scan imports or re-exports — a heuristic for dead code, with real caveats (see below) |

Add `--json` to any of `--summary`, `--focus`, `--find`, `--impact`, `--cycles`, or `--unused` to
get the underlying structured data instead of a markdown rendering — useful when the output
is consumed by code rather than read directly.

```sh
# orient on an unfamiliar project
npx ts-project-mapper src --summary

# drill into one module once you know where to look
npx ts-project-mapper src --focus src/server.ts

# find a symbol you don't have a file path for yet
npx ts-project-mapper src --find handleConnection

# what would break if I change this file?
npx ts-project-mapper src --impact src/db/parcels.ts

# visualize the whole thing
npx ts-project-mapper src --graph > graph.md
```

## Library

```ts
import {
  mapProject,
  generateSummary,
  generateFocus,
  generateDocs,
  generateGraph,
  generateFind,
  generateImpact,
  generateCycles,
  generateUnused,
} from "@matthewlovestocode/ts-project-mapper";

const projectMap = mapProject("./src");

console.log(generateSummary(projectMap));
console.log(generateFocus(projectMap, "./src/server.ts"));
console.log(generateDocs(projectMap)); // full dump
console.log(generateGraph(projectMap)); // mermaid flowchart
console.log(generateFind(projectMap, "handleConnection"));
console.log(generateImpact(projectMap, "./src/db/parcels.ts"));
console.log(generateCycles(projectMap));
console.log(generateUnused(projectMap));
```

Each `generateX()` markdown renderer has a matching `buildXData()` that returns the plain
data object instead (`buildSummaryData`, `buildFocusData`, `buildFindData`, `buildImpactData`,
`buildCycleData`, `buildUnusedData`) — what the CLI's `--json` flag uses under the hood.

`mapProject(rootDir)` returns a `ProjectMap`:

```ts
interface ProjectMap {
  rootDir: string;
  modules: ModuleNode[];
}

interface ModuleNode {
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}
```

See the exported types (`ImportInfo`, `ExportInfo`) for the full shape — each carries enough
detail to tell a default import from a named one, a type-only import from a runtime one, and
a resolved internal path from an external package.

## Path aliases

If a `tsconfig.json` with `compilerOptions.paths` exists at or above the scanned directory,
bare specifiers matching an alias (e.g. `"@/lib/foo"`) are resolved to their real file the
same way `tsc` would — including following `extends` chains.

## `--unused` is a heuristic, not a guarantee

An export counts as "used" if something in the scan imports it by name or re-exports it.
That means:

- A namespace import (`import * as ns from "./x"`) marks the whole source module as used,
  since property access through `ns` can't be tracked — this avoids false positives at the
  cost of missing some real dead code.
- Usage from outside the scanned directory is invisible. If you scan a library's `src/`
  in isolation, its own public API will look "unused" even though real consumers import it —
  scan a package's actual entry point (where its own barrel file lives), not an arbitrary
  subdirectory, for reliable results.

## Development

```sh
npm install
npm run build   # compile to dist/
npm test        # run the test suite
npm run dev     # run the CLI against source directly, via tsx
```
