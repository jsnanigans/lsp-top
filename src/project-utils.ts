import * as fs from "fs";
import * as path from "path";

/**
 * Find the nearest tsconfig.json file by walking up from the given file path
 * @param filePath - The file path to start searching from
 * @returns The absolute path to the project root (directory containing tsconfig.json), or null if not found
 */
export function findProjectRoot(filePath: string): string | null {
  // Resolve to absolute path and get directory
  const absPath = path.resolve(filePath);

  // Check if file exists
  if (!fs.existsSync(absPath)) {
    // For non-existent files, start from the directory they would be in
    let currentDir = path.dirname(absPath);

    // Walk up the directory tree
    while (currentDir !== path.dirname(currentDir)) {
      const tsconfigPath = path.join(currentDir, "tsconfig.json");
      if (fs.existsSync(tsconfigPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return null;
  }

  let currentDir = fs.statSync(absPath).isDirectory()
    ? absPath
    : path.dirname(absPath);

  // Walk up the directory tree
  while (currentDir !== path.dirname(currentDir)) {
    // Stop at root
    const tsconfigPath = path.join(currentDir, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root directory as well
  const rootTsconfig = path.join(currentDir, "tsconfig.json");
  if (fs.existsSync(rootTsconfig)) {
    return currentDir;
  }

  return null;
}

/**
 * Resolve a file path to its project root
 * @param filePath - The file path (absolute or relative)
 * @returns Object with projectRoot and resolvedFilePath
 */
export function resolveProject(filePath: string): {
  projectRoot: string | null;
  resolvedFilePath: string;
} {
  const resolvedFilePath = path.resolve(filePath);
  const projectRoot = findProjectRoot(resolvedFilePath);
  return { projectRoot, resolvedFilePath };
}
