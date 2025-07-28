import * as path from 'path';

export function resolveProjectPath(projectRoot: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(projectRoot, filePath);
}

export function makeRelativeToProject(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath);
}