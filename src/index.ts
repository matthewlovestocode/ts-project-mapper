export interface ModuleNode {
  filePath: string;
  imports: string[];
  exports: string[];
}

export interface ProjectMap {
  rootDir: string;
  modules: ModuleNode[];
}

export function mapProject(rootDir: string): ProjectMap {
  return { rootDir, modules: [] };
}
