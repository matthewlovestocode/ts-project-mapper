import fs from "node:fs";
import path from "node:path";

const RESOLUTION_SUFFIXES = [".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"];
const JS_EXTENSION_PATTERN = /\.(js|jsx|mjs|cjs)$/;

function isFile(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

export function resolveImport(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  // NodeNext ESM resolution requires relative imports to reference the compiled
  // ".js" extension even though the source file on disk is ".ts"/".tsx".
  const specifierWithoutJsExtension = specifier.replace(JS_EXTENSION_PATTERN, "");
  const resolvedBase = path.resolve(path.dirname(fromFile), specifierWithoutJsExtension);

  if (isFile(resolvedBase)) {
    return resolvedBase;
  }

  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = resolvedBase + suffix;
    if (isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}
