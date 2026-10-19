import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { AliasConfig } from "./loadAliasConfig.js";
import { resolveImport } from "./resolveImport.js";
import type { ExportInfo, ImportInfo, ModuleNode } from "./types.js";

function scriptKindFor(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".mts" || ext === ".cts") return ts.ScriptKind.TS;
  return ts.ScriptKind.TS;
}

/** True if `node` has the given modifier keyword (e.g. `export`, `default`). */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

/** Parses one `import ... from "..."` declaration, covering default/namespace/named forms. */
function parseImportDeclaration(
  node: ts.ImportDeclaration,
  filePath: string,
  aliasConfig: AliasConfig | null,
): ImportInfo {
  const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
  const isTypeOnly = node.importClause?.isTypeOnly ?? false;

  let defaultImport: string | null = null;
  let namespaceImport: string | null = null;
  const namedImports: string[] = [];

  const clause = node.importClause;
  if (clause?.name) {
    defaultImport = clause.name.text;
  }
  if (clause?.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      // import * as ns from "./x"
      namespaceImport = clause.namedBindings.name.text;
    } else if (ts.isNamedImports(clause.namedBindings)) {
      // import { a, b as c } from "./x" — record the imported name, not the local alias,
      // so this lines up with the name as it appears in the source module's exports.
      for (const element of clause.namedBindings.elements) {
        namedImports.push((element.propertyName ?? element.name).text);
      }
    }
  }

  return {
    specifier,
    resolvedPath: resolveImport(specifier, filePath, aliasConfig),
    isTypeOnly,
    defaultImport,
    namespaceImport,
    namedImports,
  };
}

/** Parses one `export { ... } [from "..."]` / `export * [as ns] from "..."` declaration. */
function parseExportDeclaration(
  node: ts.ExportDeclaration,
  filePath: string,
  aliasConfig: AliasConfig | null,
): ExportInfo[] {
  const reExportFrom = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
    ? node.moduleSpecifier.text
    : undefined;
  const reExportResolvedPath = reExportFrom ? resolveImport(reExportFrom, filePath, aliasConfig) : undefined;
  const isTypeOnly = node.isTypeOnly;

  if (!node.exportClause) {
    // export * from './x'
    return [{ name: "*", isTypeOnly, reExportFrom, reExportResolvedPath }];
  }

  if (ts.isNamespaceExport(node.exportClause)) {
    // export * as ns from './x'
    return [{ name: node.exportClause.name.text, isTypeOnly, reExportFrom, reExportResolvedPath }];
  }

  // export { a, b as c } [from './x'] — use the exported (post-`as`) name, since that's
  // the name a consumer of this module would actually import.
  return node.exportClause.elements.map((element) => ({
    name: element.name.text,
    isTypeOnly: isTypeOnly || element.isTypeOnly,
    reExportFrom,
    reExportResolvedPath,
  }));
}

function namesFromBindingName(bindingName: ts.BindingName): string[] {
  if (ts.isIdentifier(bindingName)) {
    return [bindingName.text];
  }
  // Skip destructuring patterns for now; they're uncommon on exported declarations.
  return [];
}

/**
 * Parses a top-level declaration that carries its own `export` modifier directly
 * (`export function foo() {}`, `export const x = 1`, `export interface Foo {}`, ...),
 * as opposed to a separate `export { ... }` statement.
 */
function parseExportedDeclaration(node: ts.Node): ExportInfo[] {
  const isDefault = hasModifier(node, ts.SyntaxKind.DefaultKeyword);

  if (ts.isVariableStatement(node)) {
    // export const a = 1, b = 2;
    return node.declarationList.declarations.flatMap((declaration) =>
      namesFromBindingName(declaration.name).map((name) => ({ name, isTypeOnly: false })),
    );
  }

  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    const name = isDefault ? "default" : node.name?.text;
    return name ? [{ name, isTypeOnly: false }] : [];
  }

  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    // Interfaces and type aliases are erased at runtime, so they're marked type-only;
    // enums are real runtime values, so they're not.
    const name = isDefault ? "default" : node.name.text;
    return [{ name, isTypeOnly: ts.isEnumDeclaration(node) ? false : true }];
  }

  return [];
}

/**
 * Parses a single source file into its import/export graph node.
 *
 * Only scans top-level statements (via `forEachChild`) — imports/exports nested inside
 * a function or namespace body aren't valid TypeScript module syntax anyway, so this
 * covers every real case without needing a full recursive AST walk.
 *
 * @param filePath - Absolute path to the source file to parse.
 * @param aliasConfig - tsconfig path-alias settings to resolve bare specifiers against, if any.
 */
export function analyzeModule(filePath: string, aliasConfig: AliasConfig | null = null): ModuleNode {
  const sourceText = fs.readFileSync(filePath, "utf8");
  // `setParentNodes: true` (the 4th argument) is required for node.parent to be populated,
  // which ts.canHaveModifiers/getModifiers rely on internally.
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );

  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      imports.push(parseImportDeclaration(node, filePath, aliasConfig));
    } else if (ts.isExportDeclaration(node)) {
      exports.push(...parseExportDeclaration(node, filePath, aliasConfig));
    } else if (ts.isExportAssignment(node)) {
      // export default <expression>; (as opposed to `export default function/class`,
      // which is caught by the hasModifier branch below since those are declarations.)
      exports.push({ name: "default", isTypeOnly: false });
    } else if (hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      exports.push(...parseExportedDeclaration(node));
    }
  });

  return { filePath, imports, exports };
}
