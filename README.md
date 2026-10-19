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
npx ts-project-mapper <dir> [--summary | --focus <file> | --markdown | --graph]
```

| Mode | What it does |
| --- | --- |
| _(none)_ | Full `ProjectMap` as JSON |
| `--markdown` | Full map as markdown: external deps, entry points, every module's exports/imports/dependents |
| `--summary` | Just the overview — module count, external deps, likely entry points. Cheap, bounded size; the right first call on an unfamiliar project |
| `--focus <file>` | One module's own exports/imports, plus every dependent and which names each imports from it |
| `--graph` | The internal dependency graph as a fenced ` ```mermaid ` flowchart — renders inline on GitHub, VS Code's markdown preview, etc. |

```sh
# orient on an unfamiliar project
npx ts-project-mapper src --summary

# drill into one module once you know where to look
npx ts-project-mapper src --focus src/server.ts

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
} from "@matthewlovestocode/ts-project-mapper";

const projectMap = mapProject("./src");

console.log(generateSummary(projectMap));
console.log(generateFocus(projectMap, "./src/server.ts"));
console.log(generateDocs(projectMap)); // full dump
console.log(generateGraph(projectMap)); // mermaid flowchart
```

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

## Development

```sh
npm install
npm run build   # compile to dist/
npm test        # run the test suite
npm run dev     # run the CLI against source directly, via tsx
```
