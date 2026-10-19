/** A single `import` declaration found in a module. */
export interface ImportInfo {
  /** The specifier exactly as written, e.g. `"./foo.js"` or `"zod"`. */
  specifier: string;
  /**
   * Absolute path to the file this import resolves to, if it's internal to the
   * project (a relative import or a matched tsconfig path alias). `null` for
   * external packages, or for a specifier that couldn't be resolved to a file
   * on disk.
   */
  resolvedPath: string | null;
  /** True for `import type { ... }` declarations. */
  isTypeOnly: boolean;
  /** The local name bound to a default import, e.g. `foo` in `import foo from "./x"`. */
  defaultImport: string | null;
  /** The local name bound to a namespace import, e.g. `ns` in `import * as ns from "./x"`. */
  namespaceImport: string | null;
  /** Named imports, using the imported (not local/aliased) name, e.g. `a` in `import { a as b } from "./x"`. */
  namedImports: string[];
}

/** A single export produced by an `export` declaration, including re-exports. */
export interface ExportInfo {
  /** The exported name. `"default"` for a default export, `"*"` for `export * from "./x"`. */
  name: string;
  /** True for a `type`-only export (`export type { ... }`) or a type-only declaration. */
  isTypeOnly: boolean;
  /** The specifier this was re-exported from, for `export { x } from "./y"` style exports. */
  reExportFrom?: string;
  /** Resolved path for `reExportFrom`, following the same rules as {@link ImportInfo.resolvedPath}. */
  reExportResolvedPath?: string | null;
  /**
   * Whether the declaration itself has a `/** ... *\/` JSDoc comment. Only meaningful for
   * exports defined directly in this module (`export function foo() {}`, etc.) — `undefined`
   * for re-exports (`export { x } from "./y"`), since the doc, if any, lives at the original
   * definition in `y`, not here.
   */
  hasJsDoc?: boolean;
}

/** The imports and exports found in a single source file. */
export interface ModuleNode {
  /** Absolute path to the source file. */
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

/** The full import/export graph for a project: every module found under `rootDir`. */
export interface ProjectMap {
  /** Absolute path to the directory that was scanned. */
  rootDir: string;
  modules: ModuleNode[];
}
