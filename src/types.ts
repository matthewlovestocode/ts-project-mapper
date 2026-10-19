export interface ImportInfo {
  specifier: string;
  resolvedPath: string | null;
  isTypeOnly: boolean;
  defaultImport: string | null;
  namespaceImport: string | null;
  namedImports: string[];
}

export interface ExportInfo {
  name: string;
  isTypeOnly: boolean;
  reExportFrom?: string;
  reExportResolvedPath?: string | null;
}

export interface ModuleNode {
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface ProjectMap {
  rootDir: string;
  modules: ModuleNode[];
}
