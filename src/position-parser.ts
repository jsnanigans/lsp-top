/**
 * Unified position parser for all commands
 * Handles formats: file, file:line, file:line:col
 */

import * as path from "path";
import * as fs from "fs";

export interface Position {
  file: string;
  line?: number;
  column?: number;
}

/**
 * Parse a position string into components
 * Supports:
 * - file.ts
 * - file.ts:10
 * - file.ts:10:5
 * - - (stdin)
 */
export function parsePosition(input: string): Position {
  if (!input || input === "-") {
    throw new Error("stdin input not yet implemented");
  }

  const parts = input.split(":");

  if (parts.length === 1) {
    // Just a file
    return { file: parts[0] };
  }

  if (parts.length === 2) {
    // File and line
    const line = parseInt(parts[1], 10);
    if (isNaN(line)) {
      throw new Error(`Invalid line number: ${parts[1]}`);
    }
    return { file: parts[0], line };
  }

  if (parts.length === 3) {
    // File, line, and column
    const line = parseInt(parts[1], 10);
    const column = parseInt(parts[2], 10);

    if (isNaN(line)) {
      throw new Error(`Invalid line number: ${parts[1]}`);
    }
    if (isNaN(column)) {
      throw new Error(`Invalid column number: ${parts[2]}`);
    }

    return { file: parts[0], line, column };
  }

  throw new Error(`Invalid position format: ${input}. Use file:line:col`);
}

/**
 * Resolve a file path to absolute path
 */
export function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
}

/**
 * Validate that a file exists
 */
export function validateFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

/**
 * Parse and validate a position
 */
export function parseAndValidatePosition(
  input: string,
): Position & { resolvedPath: string } {
  const pos = parsePosition(input);
  const resolvedPath = resolveFilePath(pos.file);
  validateFile(resolvedPath);

  return {
    ...pos,
    file: resolvedPath,
    resolvedPath,
  };
}

/**
 * Format a position back to string
 */
export function formatPosition(pos: Position): string {
  let result = pos.file;
  if (pos.line !== undefined) {
    result += `:${pos.line}`;
    if (pos.column !== undefined) {
      result += `:${pos.column}`;
    }
  }
  return result;
}
