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

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

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
      namespaceImport = clause.namedBindings.name.text;
    } else if (ts.isNamedImports(clause.namedBindings)) {
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

  // export { a, b as c } [from './x']
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

function parseExportedDeclaration(node: ts.Node): ExportInfo[] {
  const isDefault = hasModifier(node, ts.SyntaxKind.DefaultKeyword);

  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((declaration) =>
      namesFromBindingName(declaration.name).map((name) => ({ name, isTypeOnly: false })),
    );
  }

  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    const name = isDefault ? "default" : node.name?.text;
    return name ? [{ name, isTypeOnly: false }] : [];
  }

  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    const name = isDefault ? "default" : node.name.text;
    return [{ name, isTypeOnly: ts.isEnumDeclaration(node) ? false : true }];
  }

  return [];
}

export function analyzeModule(filePath: string, aliasConfig: AliasConfig | null = null): ModuleNode {
  const sourceText = fs.readFileSync(filePath, "utf8");
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
      exports.push({ name: "default", isTypeOnly: false });
    } else if (hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      exports.push(...parseExportedDeclaration(node));
    }
  });

  return { filePath, imports, exports };
}
