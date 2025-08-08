/**
 * Unix-compatible output formatter
 * Produces aligned text output by default, TSV with --no-align, JSON with --json
 */

import * as fs from "fs";
import * as path from "path";

export interface FormatOptions {
  json?: boolean;
  verbose?: boolean;
  delimiter?: string;
  noHeaders?: boolean;
  contextLines?: number;
  align?: boolean;  // Align columns for readability (default: true)
}

export interface ResultRow {
  file: string;
  line: number;
  column: number;
  type: string;
  details: string[];
}

/**
 * Convert URI to relative file path
 */
function uriToPath(uri: string): string {
  const filePath = uri.replace("file://", "");
  // Always make paths relative to cwd for consistency
  if (path.isAbsolute(filePath)) {
    const relative = path.relative(process.cwd(), filePath);
    // If the file is outside cwd (starts with ..), show just the basename
    if (relative.startsWith("..")) {
      return path.basename(filePath);
    }
    return relative || ".";
  }
  return filePath;
}

/**
 * Format rows with optional alignment
 */
function formatRows(rows: ResultRow[], options: FormatOptions = {}): string {
  if (rows.length === 0) return "";
  
  // For pure TSV output (no alignment)
  if (options.align === false) {
    return rows.map(row => {
      const fields = [
        row.file,
        row.line.toString(),
        row.column.toString(),
        row.type,
        ...row.details
      ];
      return fields.join("\t");  // Always use tabs for TSV
    }).join("\n");
  }
  
  // For aligned output (default) - like ls -l
  // Calculate column widths
  const maxFile = Math.max(...rows.map(r => r.file.length));
  const maxLine = Math.max(...rows.map(r => r.line.toString().length));
  const maxCol = Math.max(...rows.map(r => r.column.toString().length));
  const maxType = Math.max(...rows.map(r => r.type.length));
  
  // Calculate detail column widths
  const maxDetails: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.details.length; i++) {
      if (!maxDetails[i]) maxDetails[i] = 0;
      maxDetails[i] = Math.max(maxDetails[i], row.details[i].length);
    }
  }
  
  // Format with padding
  return rows.map(row => {
    const parts = [
      row.file.padEnd(maxFile),
      row.line.toString().padStart(maxLine),
      row.column.toString().padStart(maxCol),
      row.type.padEnd(maxType)
    ];
    
    // Add details with proper padding
    for (let i = 0; i < row.details.length; i++) {
      const detail = row.details[i] || "";
      // Pad all but the last detail
      if (i < row.details.length - 1 && maxDetails[i]) {
        parts.push(detail.padEnd(maxDetails[i]));
      } else {
        parts.push(detail);
      }
    }
    
    // Use double space for readability
    return parts.join("  ");
  }).join("\n");
}

/**
 * Get file context lines
 */
function getContext(filePath: string, line: number, contextLines: number = 3): string[] {
  try {
    const content = fs.readFileSync(filePath.replace("file://", ""), "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, line - contextLines - 1);
    const end = Math.min(lines.length, line + contextLines);
    
    const result: string[] = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const prefix = lineNum === line ? ">" : " ";
      result.push(`  ${prefix}${lineNum.toString().padStart(3)} | ${lines[i]}`);
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Format definition results - single result expected
 */
export function formatDefinition(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "definition",
      results: Array.isArray(data) ? data : data ? [data] : []
    });
  }

  if (!data) return "";
  
  const locations = Array.isArray(data) ? data : [data];
  if (locations.length === 0) return "";

  const results: string[] = [];
  
  for (const loc of locations) {
    if (!loc || !loc.uri) continue;
    
    const file = uriToPath(loc.uri);
    const line = loc.range.start.line + 1;
    const col = loc.range.start.character + 1;
    
    // Simple format: just the location
    results.push(`${file}:${line}:${col}`);
    
    // Add context if verbose
    if (options.verbose && options.contextLines) {
      const context = getContext(loc.uri, line, options.contextLines);
      if (context.length > 0) {
        results.push(...context);
      }
    }
  }
  
  return results.join("\n");
}

/**
 * Format references results - list of locations
 */
export function formatReferences(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "references",
      results: Array.isArray(data) ? data : []
    });
  }

  if (!data || !Array.isArray(data)) return "";
  
  const results: string[] = [];
  
  for (const ref of data) {
    if (!ref || !ref.uri) continue;
    
    const file = uriToPath(ref.uri);
    const line = ref.range.start.line + 1;
    const col = ref.range.start.character + 1;
    
    // Simple format: file:line:col
    results.push(`${file}:${line}:${col}`);
  }
  
  return results.join("\n");
}

/**
 * Format diagnostics results - follows TypeScript compiler format
 */
export function formatDiagnostics(data: any, options: FormatOptions = {}, context?: any): string {
  if (options.json) {
    return JSON.stringify({
      command: "diagnostics",
      results: data?.diagnostics || data || []
    });
  }

  const diagnostics = data?.diagnostics || data;
  if (!diagnostics || !Array.isArray(diagnostics)) return "";
  
  const severityMap: { [key: number]: string } = {
    1: "error",
    2: "warning", 
    3: "info",
    4: "hint"
  };
  
  // Get the file path from context - use relative path
  let filePath = context?.file || ".";
  if (filePath && filePath !== ".") {
    filePath = path.isAbsolute(filePath) 
      ? path.relative(process.cwd(), filePath) || "."
      : filePath;
  }
  
  // Use compiler-style format: file:line:col: severity code: message
  const results: string[] = [];
  
  for (const diag of diagnostics) {
    const line = diag.range.start.line + 1;
    const col = diag.range.start.character + 1;
    const severity = severityMap[diag.severity] || "info";
    const code = diag.code ? `TS${diag.code}` : "";
    
    // Format: file:line:col: severity [code]: message
    // This matches TypeScript and GCC output format
    if (code) {
      results.push(`${filePath}:${line}:${col}: ${severity} ${code}: ${diag.message}`);
    } else {
      results.push(`${filePath}:${line}:${col}: ${severity}: ${diag.message}`);
    }
  }
  
  return results.join("\n");
}

/**
 * Format hover results - just show the content
 */
export function formatHover(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "hover",
      results: data ? [data] : []
    });
  }

  if (!data || !data.contents) return "";
  
  let content = "";
  if (typeof data.contents === "string") {
    content = data.contents;
  } else if (data.contents.value) {
    content = data.contents.value;
  } else if (Array.isArray(data.contents)) {
    content = data.contents
      .map((c: any) => (typeof c === "string" ? c : c.value))
      .join("\n");
  }
  
  // Clean up markdown code blocks but preserve structure
  content = content.replace(/```(\w+)?\n/g, "").replace(/```/g, "").trim();
  
  return content;
}

/**
 * Format symbols results - for a single file
 */
export function formatSymbols(data: any, options: FormatOptions = {}, context?: any): string {
  if (options.json) {
    return JSON.stringify({
      command: "symbols",
      results: data || []
    });
  }

  // Handle wrapped response from daemon
  const symbols = data?.symbols || data;
  if (!symbols || !Array.isArray(symbols)) return "";
  
  const kindMap: { [key: number]: string } = {
    5: "class",
    6: "method",
    7: "property",
    9: "constructor",
    10: "enum",
    11: "interface",
    12: "function",
    13: "variable",
    14: "constant",
    22: "enum-member",
    26: "type-parameter"
  };
  
  const results: string[] = [];
  
  // Get the file path from context if available
  let filePath = context?.file;
  if (filePath && path.isAbsolute(filePath)) {
    filePath = path.relative(process.cwd(), filePath) || ".";
  }
  
  function processSymbol(symbol: any, indent: number = 0) {
    const kind = kindMap[symbol.kind] || "symbol";
    const line = symbol.location?.range?.start?.line ?? symbol.range?.start?.line ?? 0;
    const col = symbol.location?.range?.start?.character ?? symbol.range?.start?.character ?? 0;
    
    // Format: [indent]name (kind) at line:col
    const prefix = "  ".repeat(indent);
    if (filePath && line > 0) {
      results.push(`${prefix}${symbol.name} (${kind}) at ${line + 1}:${col + 1}`);
    } else {
      results.push(`${prefix}${symbol.name} (${kind})`);
    }
    
    // Process children with increased indent
    if (symbol.children && Array.isArray(symbol.children)) {
      for (const child of symbol.children) {
        processSymbol(child, indent + 1);
      }
    }
  }
  
  // If we have a file path, show it as a header
  if (filePath) {
    results.push(`${filePath}:`);
  }
  
  for (const symbol of symbols) {
    processSymbol(symbol);
  }
  
  return results.join("\n");
}

/**
 * Format workspace symbols - consistent with other commands
 */
export function formatWorkspaceSymbols(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "workspace-symbols",
      results: data?.symbols || []
    });
  }

  const symbols = data?.symbols || data;
  if (!symbols || !Array.isArray(symbols)) return "";
  
  const kindMap: { [key: number]: string } = {
    5: "class",
    6: "method",
    7: "property",
    9: "constructor",
    10: "enum",
    11: "interface",
    12: "function",
    13: "variable",
    14: "constant"
  };
  
  const results: string[] = [];
  
  for (const symbol of symbols) {
    const kind = kindMap[symbol.kind] || "symbol";
    const uri = symbol.location?.uri || symbol.uri;
    const file = uri ? uriToPath(uri) : ".";
    const line = symbol.location?.range?.start?.line ?? symbol.range?.start?.line ?? 0;
    const col = symbol.location?.range?.start?.character ?? symbol.range?.start?.character ?? 0;
    
    // Format: file:line:col: kind: name [in container]
    let result = `${file}:${line + 1}:${col + 1}: ${kind}: ${symbol.name}`;
    if (symbol.containerName) {
      result += ` (in ${symbol.containerName})`;
    }
    results.push(result);
  }
  
  return results.join("\n");
}

/**
 * Format rename preview
 */
export function formatRename(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "rename",
      results: data
    });
  }

  if (!data || !data.changes) return "";
  
  const rows: ResultRow[] = [];
  
  for (const [uri, edits] of Object.entries(data.changes)) {
    for (const edit of edits as any[]) {
      rows.push({
        file: uriToPath(uri),
        line: edit.range.start.line + 1,
        column: edit.range.start.character + 1,
        type: "edit",
        details: [edit.newText || ""]
      });
    }
  }
  
  return formatRows(rows, options);
}

/**
 * Format call hierarchy
 */
export function formatCallHierarchy(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "call-hierarchy",
      results: data
    });
  }

  if (!data || !data.item) return "";
  
  const rows: ResultRow[] = [];
  
  // Current item
  const item = data.item;
  rows.push({
    file: uriToPath(item.uri),
    line: item.range.start.line + 1,
    column: item.range.start.character + 1,
    type: "current",
    details: [item.name]
  });
  
  // Incoming calls
  if (data.incoming) {
    for (const call of data.incoming) {
      const from = call.from;
      rows.push({
        file: uriToPath(from.uri),
        line: from.range.start.line + 1,
        column: from.range.start.character + 1,
        type: "incoming",
        details: [from.name]
      });
    }
  }
  
  // Outgoing calls
  if (data.outgoing) {
    for (const call of data.outgoing) {
      const to = call.to;
      rows.push({
        file: uriToPath(to.uri),
        line: to.range.start.line + 1,
        column: to.range.start.character + 1,
        type: "outgoing",
        details: [to.name]
      });
    }
  }
  
  return formatRows(rows, options);
}

/**
 * Format type hierarchy
 */
export function formatTypeHierarchy(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "type-hierarchy",
      results: data
    });
  }

  if (!data || !data.item) return "";
  
  const rows: ResultRow[] = [];
  
  // Current item
  const item = data.item;
  rows.push({
    file: uriToPath(item.uri),
    line: item.range.start.line + 1,
    column: item.range.start.character + 1,
    type: "current",
    details: [item.name]
  });
  
  // Supertypes
  if (data.supertypes) {
    for (const supertype of data.supertypes) {
      rows.push({
        file: uriToPath(supertype.uri),
        line: supertype.range.start.line + 1,
        column: supertype.range.start.character + 1,
        type: "supertype",
        details: [supertype.name]
      });
    }
  }
  
  // Subtypes
  if (data.subtypes) {
    for (const subtype of data.subtypes) {
      rows.push({
        file: uriToPath(subtype.uri),
        line: subtype.range.start.line + 1,
        column: subtype.range.start.character + 1,
        type: "subtype",
        details: [subtype.name]
      });
    }
  }
  
  return formatRows(rows, options);
}

/**
 * Generic formatter that routes to specific formatters
 */
export function format(command: string, data: any, options: FormatOptions = {}, context?: any): string {
  switch (command) {
    case "definition":
    case "typeDefinition":
      return formatDefinition(data, options);
    case "references":
    case "implementation":
      return formatReferences(data, options);
    case "diagnostics":
      return formatDiagnostics(data, options, context);
    case "hover":
      return formatHover(data, options);
    case "symbols":
    case "outline":
      return formatSymbols(data, options, context);
    case "workspaceSymbols":
      return formatWorkspaceSymbols(data, options);
    case "rename":
      return formatRename(data, options);
    case "callHierarchy":
      return formatCallHierarchy(data, options);
    case "typeHierarchy":
      return formatTypeHierarchy(data, options);
    default:
      return options.json ? JSON.stringify(data) : "";
  }
}