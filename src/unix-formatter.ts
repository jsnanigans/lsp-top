/**
 * Unix-compatible output formatter
 * Produces TSV output by default, with optional JSON
 */

import * as fs from "fs";
import * as path from "path";

export interface FormatOptions {
  json?: boolean;
  verbose?: boolean;
  delimiter?: string;
  noHeaders?: boolean;
  contextLines?: number;
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
function uriToPath(uri: string, projectRoot?: string): string {
  const filePath = uri.replace("file://", "");
  if (projectRoot) {
    const relative = path.relative(projectRoot, filePath);
    return relative.startsWith("..") ? filePath : relative;
  }
  return filePath;
}

/**
 * Format a single row as TSV
 */
function formatRow(row: ResultRow, delimiter: string = "\t"): string {
  const fields = [
    row.file,
    row.line.toString(),
    row.column.toString(),
    row.type,
    ...row.details
  ];
  return fields.join(delimiter);
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
 * Format definition results
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
    
    const row: ResultRow = {
      file: uriToPath(loc.uri),
      line: loc.range.start.line + 1,
      column: loc.range.start.character + 1,
      type: "definition",
      details: []
    };
    
    results.push(formatRow(row, options.delimiter));
    
    if (options.verbose && options.contextLines) {
      const context = getContext(loc.uri, row.line, options.contextLines);
      results.push(...context);
    }
  }
  
  return results.join("\n");
}

/**
 * Format references results
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
    
    const row: ResultRow = {
      file: uriToPath(ref.uri),
      line: ref.range.start.line + 1,
      column: ref.range.start.character + 1,
      type: "reference",
      details: []
    };
    
    results.push(formatRow(row, options.delimiter));
    
    if (options.verbose && options.contextLines) {
      const context = getContext(ref.uri, row.line, options.contextLines);
      results.push(...context);
    }
  }
  
  return results.join("\n");
}

/**
 * Format diagnostics results
 */
export function formatDiagnostics(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "diagnostics",
      results: data?.diagnostics || data || []
    });
  }

  const diagnostics = data?.diagnostics || data;
  if (!diagnostics || !Array.isArray(diagnostics)) return "";
  
  const results: string[] = [];
  const severityMap: { [key: number]: string } = {
    1: "error",
    2: "warning",
    3: "info",
    4: "hint"
  };
  
  for (const diag of diagnostics) {
    const row: ResultRow = {
      file: options.verbose ? diag.source || "current" : ".",
      line: diag.range.start.line + 1,
      column: diag.range.start.character + 1,
      type: severityMap[diag.severity] || "info",
      details: [
        diag.code || "",
        diag.message
      ]
    };
    
    results.push(formatRow(row, options.delimiter));
  }
  
  return results.join("\n");
}

/**
 * Format hover results
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
      .join(" ");
  }
  
  // Clean up markdown formatting
  content = content
    .replace(/```\w*\n?/g, "")
    .replace(/\n+/g, " ")
    .trim();
  
  const row: ResultRow = {
    file: ".",
    line: 0,
    column: 0,
    type: "hover",
    details: [content]
  };
  
  return formatRow(row, options.delimiter);
}

/**
 * Format symbols results
 */
export function formatSymbols(data: any, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify({
      command: "symbols",
      results: data || []
    });
  }

  if (!data || !Array.isArray(data)) return "";
  
  const results: string[] = [];
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
  
  function processSymbol(symbol: any, containerName?: string) {
    const kind = kindMap[symbol.kind] || "symbol";
    const line = symbol.location?.range?.start?.line ?? symbol.range?.start?.line ?? 0;
    const col = symbol.location?.range?.start?.character ?? symbol.range?.start?.character ?? 0;
    
    const row: ResultRow = {
      file: symbol.location?.uri ? uriToPath(symbol.location.uri) : ".",
      line: line + 1,
      column: col + 1,
      type: kind,
      details: containerName ? [symbol.name, containerName] : [symbol.name]
    };
    
    results.push(formatRow(row, options.delimiter));
    
    // Process children
    if (symbol.children && Array.isArray(symbol.children)) {
      for (const child of symbol.children) {
        processSymbol(child, symbol.name);
      }
    }
  }
  
  for (const symbol of data) {
    processSymbol(symbol);
  }
  
  return results.join("\n");
}

/**
 * Format workspace symbols
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
  
  const results: string[] = [];
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
  
  for (const symbol of symbols) {
    const kind = kindMap[symbol.kind] || "symbol";
    const uri = symbol.location?.uri || symbol.uri;
    const line = symbol.location?.range?.start?.line ?? symbol.range?.start?.line ?? 0;
    const col = symbol.location?.range?.start?.character ?? symbol.range?.start?.character ?? 0;
    
    const row: ResultRow = {
      file: uri ? uriToPath(uri) : ".",
      line: line + 1,
      column: col + 1,
      type: kind,
      details: [symbol.name]
    };
    
    if (symbol.containerName) {
      row.details.push(symbol.containerName);
    }
    
    results.push(formatRow(row, options.delimiter));
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
  
  const results: string[] = [];
  
  for (const [uri, edits] of Object.entries(data.changes)) {
    for (const edit of edits as any[]) {
      const row: ResultRow = {
        file: uriToPath(uri),
        line: edit.range.start.line + 1,
        column: edit.range.start.character + 1,
        type: "edit",
        details: [edit.newText || ""]
      };
      
      results.push(formatRow(row, options.delimiter));
    }
  }
  
  return results.join("\n");
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
  
  const results: string[] = [];
  
  // Current item
  const item = data.item;
  const row: ResultRow = {
    file: uriToPath(item.uri),
    line: item.range.start.line + 1,
    column: item.range.start.character + 1,
    type: "current",
    details: [item.name]
  };
  results.push(formatRow(row, options.delimiter));
  
  // Incoming calls
  if (data.incoming) {
    for (const call of data.incoming) {
      const from = call.from;
      const inRow: ResultRow = {
        file: uriToPath(from.uri),
        line: from.range.start.line + 1,
        column: from.range.start.character + 1,
        type: "incoming",
        details: [from.name]
      };
      results.push(formatRow(inRow, options.delimiter));
    }
  }
  
  // Outgoing calls
  if (data.outgoing) {
    for (const call of data.outgoing) {
      const to = call.to;
      const outRow: ResultRow = {
        file: uriToPath(to.uri),
        line: to.range.start.line + 1,
        column: to.range.start.character + 1,
        type: "outgoing",
        details: [to.name]
      };
      results.push(formatRow(outRow, options.delimiter));
    }
  }
  
  return results.join("\n");
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
  
  const results: string[] = [];
  
  // Current item
  const item = data.item;
  const row: ResultRow = {
    file: uriToPath(item.uri),
    line: item.range.start.line + 1,
    column: item.range.start.character + 1,
    type: "current",
    details: [item.name]
  };
  results.push(formatRow(row, options.delimiter));
  
  // Supertypes
  if (data.supertypes) {
    for (const supertype of data.supertypes) {
      const superRow: ResultRow = {
        file: uriToPath(supertype.uri),
        line: supertype.range.start.line + 1,
        column: supertype.range.start.character + 1,
        type: "supertype",
        details: [supertype.name]
      };
      results.push(formatRow(superRow, options.delimiter));
    }
  }
  
  // Subtypes
  if (data.subtypes) {
    for (const subtype of data.subtypes) {
      const subRow: ResultRow = {
        file: uriToPath(subtype.uri),
        line: subtype.range.start.line + 1,
        column: subtype.range.start.character + 1,
        type: "subtype",
        details: [subtype.name]
      };
      results.push(formatRow(subRow, options.delimiter));
    }
  }
  
  return results.join("\n");
}

/**
 * Generic formatter that routes to specific formatters
 */
export function format(command: string, data: any, options: FormatOptions = {}): string {
  switch (command) {
    case "definition":
    case "typeDefinition":
      return formatDefinition(data, options);
    case "references":
    case "implementation":
      return formatReferences(data, options);
    case "diagnostics":
      return formatDiagnostics(data, options);
    case "hover":
      return formatHover(data, options);
    case "symbols":
    case "outline":
      return formatSymbols(data, options);
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