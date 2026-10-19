import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Size/complexity metrics for one function-like node (function, method, arrow, etc.). */
export interface FunctionComplexity {
  /** Best-effort name for reporting — a function/method name, or the variable it's assigned to. */
  name: string;
  /** 1-indexed source line the function starts on. */
  startLine: number;
  /** 1-indexed source line the function ends on. */
  endLine: number;
  lineCount: number;
  /** McCabe cyclomatic complexity of this function's own body, excluding nested functions. */
  cyclomaticComplexity: number;
  parameterCount: number;
  /** Deepest nesting of control-flow blocks (if/for/while/switch/try) within this function. */
  maxNestingDepth: number;
}

/** Size metrics for one source file: its own line count, declaration count, and every function in it. */
export interface FileComplexity {
  filePath: string;
  lineCount: number;
  /** Top-level functions/classes/interfaces/type aliases/enums/const-statements, exported or not. */
  topLevelDeclarationCount: number;
  functions: FunctionComplexity[];
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  return path.extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

type FunctionLikeNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLikeNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** Best-effort human name for a function-like node — for reporting, not a stable identifier. */
function nameOf(node: FunctionLikeNode): string {
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isGetAccessorDeclaration(node)) return `get ${node.name.getText()}`;
  if (ts.isSetAccessorDeclaration(node)) return `set ${node.name.getText()}`;

  if (ts.isMethodDeclaration(node)) {
    const className = ts.isClassDeclaration(node.parent) ? node.parent.name?.text : undefined;
    const methodName = node.name.getText();
    return className ? `${className}.${methodName}` : methodName;
  }

  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
    return node.name.text;
  }

  // Anonymous function/arrow expression — fall back to the name it's assigned to, if any.
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text;
  }

  return "<anonymous>";
}

// Each adds one independent path through the function.
const DECISION_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.CaseClause,
]);

// Each adds one level of nesting depth while walking downward.
const NESTING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

function isShortCircuit(node: ts.Node): boolean {
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  );
}

/**
 * Cyclomatic complexity and max nesting depth of one function's own body. Stops at any
 * nested function boundary — a nested function's branches belong to its own complexity,
 * not its enclosing function's, so they're measured separately when the outer walk in
 * analyzeComplexity() reaches them.
 */
function measureBody(body: ts.Node): { complexity: number; maxNestingDepth: number } {
  let complexity = 1; // the one baseline path with no branches taken
  let maxNestingDepth = 0;

  function walk(node: ts.Node, depth: number): void {
    if (node !== body && isFunctionLike(node)) return;

    if (DECISION_KINDS.has(node.kind) || isShortCircuit(node)) complexity += 1;

    const nextDepth = NESTING_KINDS.has(node.kind) ? depth + 1 : depth;
    maxNestingDepth = Math.max(maxNestingDepth, nextDepth);

    node.forEachChild((child) => walk(child, nextDepth));
  }

  walk(body, 0);
  return { complexity, maxNestingDepth };
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Parses one source file and measures every function in it, at any nesting depth —
 * a deeper walk than analyzeModule()'s top-level-only scan, since complexity lives
 * inside function bodies, not in the module-level import/export structure.
 */
export function analyzeComplexity(filePath: string): FileComplexity {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );

  let topLevelDeclarationCount = 0;
  sourceFile.forEachChild((node) => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isVariableStatement(node)
    ) {
      topLevelDeclarationCount += 1;
    }
  });

  const functions: FunctionComplexity[] = [];

  function visit(node: ts.Node): void {
    if (isFunctionLike(node) && node.body) {
      const startLine = lineOf(sourceFile, node.getStart(sourceFile));
      const endLine = lineOf(sourceFile, node.getEnd());
      const { complexity, maxNestingDepth } = measureBody(node.body);

      functions.push({
        name: nameOf(node),
        startLine,
        endLine,
        lineCount: endLine - startLine + 1,
        cyclomaticComplexity: complexity,
        parameterCount: node.parameters.length,
        maxNestingDepth,
      });
    }

    // Keep descending even into a function's own body, to find any functions nested
    // inside it — each gets its own entry, measured independently of its enclosing scope.
    node.forEachChild(visit);
  }

  visit(sourceFile);

  return {
    filePath,
    lineCount: sourceText.split("\n").length,
    topLevelDeclarationCount,
    functions,
  };
}
