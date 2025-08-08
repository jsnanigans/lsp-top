import * as fs from "fs";
import * as path from "path";

interface Location {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * Format a file path for display
 */
function formatFilePath(uri: string, projectRoot?: string): string {
  const filePath = uri.replace("file://", "");
  if (projectRoot) {
    return path.relative(projectRoot, filePath) || filePath;
  }
  return filePath;
}

/**
 * Read file lines with context
 */
function getFileContext(
  filePath: string,
  line: number,
  contextLines: number = 3,
): string[] {
  try {
    const content = fs.readFileSync(filePath.replace("file://", ""), "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, line - contextLines);
    const end = Math.min(lines.length, line + contextLines + 1);

    const result: string[] = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const isTarget = lineNum === line + 1;
      const prefix = isTarget ? ">" : " ";
      result.push(`${prefix} ${String(lineNum).padStart(4)} │ ${lines[i]}`);
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Format a location with context
 */
function formatLocation(
  location: Location,
  context?: any,
  showContext: boolean = true,
): string {
  const filePath = formatFilePath(location.uri, context?.projectRoot);
  const line = location.range.start.line + 1;
  const col = location.range.start.character + 1;

  let result = `${filePath}:${line}:${col}`;

  if (showContext && context?.contextLines) {
    const lines = getFileContext(
      location.uri,
      location.range.start.line,
      context.contextLines,
    );
    if (lines.length > 0) {
      result += "\n┌─────────────────────────────────────────────────┐\n";
      result += lines.join("\n");
      result += "\n└─────────────────────────────────────────────────┘";
    }
  }

  return result;
}

/**
 * Format hover information
 */
function formatHover(data: any, context?: any): string {
  if (!data || !data.contents) {
    return "No hover information available";
  }

  let result = "";

  // Add location header if available
  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    result += `${filePath}:${context.line}:${context.col}\n`;
    result += "─".repeat(50) + "\n";
  }

  // Format hover content
  if (typeof data.contents === "string") {
    result += data.contents;
  } else if (data.contents.value) {
    // Handle MarkupContent
    const content = data.contents.value;
    // Clean up markdown code blocks for terminal display
    result += content.replace(/```(\w+)?\n/g, "").replace(/```/g, "");
  } else if (Array.isArray(data.contents)) {
    // Handle array of MarkedString
    result += data.contents
      .map((c: any) => (typeof c === "string" ? c : c.value))
      .join("\n");
  }

  return result.trim();
}

/**
 * Format diagnostics
 */
function formatDiagnostics(data: any, context?: any): string {
  // Check for errors in the response
  if (data && data.error) {
    return `✗ Failed to get diagnostics: ${data.error}`;
  }

  // Handle wrapped response from daemon
  const diagnostics = data?.diagnostics || data;

  if (!diagnostics || !Array.isArray(diagnostics)) {
    // Check if this might be due to a server issue
    if (data?.serverStatus === "unhealthy") {
      return '✗ Language server is not responding. Try running "lsp-top daemon restart"';
    }
    return "No diagnostics found";
  }

  if (diagnostics.length === 0) {
    return "✓ No issues found";
  }

  // Group diagnostics by severity
  const errors = diagnostics.filter((d: any) => d.severity === 1);
  const warnings = diagnostics.filter((d: any) => d.severity === 2);
  const info = diagnostics.filter((d: any) => d.severity === 3);
  const hints = diagnostics.filter((d: any) => d.severity === 4);

  let result = "";

  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    result += `Diagnostics for ${filePath}:\n\n`;
  }

  if (errors.length > 0) {
    result += `ERRORS (${errors.length}):\n`;
    for (const diag of errors) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `  ✗ [${line}:${col}] ${diag.message}`;
      if (diag.code) {
        result += ` (${diag.code})`;
      }
      result += "\n";
    }
    result += "\n";
  }

  if (warnings.length > 0) {
    result += `WARNINGS (${warnings.length}):\n`;
    for (const diag of warnings) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `  ⚠ [${line}:${col}] ${diag.message}`;
      if (diag.code) {
        result += ` (${diag.code})`;
      }
      result += "\n";
    }
    result += "\n";
  }

  if (info.length > 0) {
    result += `INFO (${info.length}):\n`;
    for (const diag of info) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `  ℹ [${line}:${col}] ${diag.message}`;
      if (diag.code) {
        result += ` (${diag.code})`;
      }
      result += "\n";
    }
    result += "\n";
  }

  if (hints.length > 0) {
    result += `HINTS (${hints.length}):\n`;
    for (const diag of hints) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `  💡 [${line}:${col}] ${diag.message}`;
      if (diag.code) {
        result += ` (${diag.code})`;
      }
      result += "\n";
    }
    result += "\n";
  }

  // Add summary
  result += `─────────────────────────────────────────────────\n`;
  result += `Total: ${errors.length} error${errors.length !== 1 ? "s" : ""}, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}, ${info.length} info, ${hints.length} hint${hints.length !== 1 ? "s" : ""}`;

  return result.trim();
}

/**
 * Format references
 */
function formatReferences(data: any, context?: any): string {
  if (!data || !Array.isArray(data)) {
    return "No references found";
  }

  if (data.length === 0) {
    return "No references found";
  }

  let result = `Found ${data.length} reference${data.length === 1 ? "" : "s"}:\n\n`;

  if (context?.groupByFile) {
    // Group references by file
    const grouped = data.reduce((acc: any, ref: Location) => {
      const file = formatFilePath(ref.uri, context.projectRoot);
      if (!acc[file]) acc[file] = [];
      acc[file].push(ref);
      return acc;
    }, {});

    for (const [file, refs] of Object.entries(grouped)) {
      result += `${file} (${(refs as Location[]).length}):\n`;
      for (const ref of refs as Location[]) {
        const line = ref.range.start.line + 1;
        const col = ref.range.start.character + 1;
        result += `  ${line}:${col}\n`;
      }
      result += "\n";
    }
  } else {
    // List all references
    let count = 0;
    for (const ref of data) {
      if (context?.limit && count >= context.limit) {
        result += `\n... and ${data.length - count} more`;
        break;
      }
      result += formatLocation(ref, context, false) + "\n";
      count++;
    }
  }

  return result.trim();
}

/**
 * Format symbols
 */
function formatSymbols(data: any, context?: any): string {
  if (!data || !Array.isArray(data)) {
    return "No symbols found";
  }

  if (data.length === 0) {
    return "No symbols found";
  }

  const kindMap: { [key: number]: string } = {
    1: "File",
    2: "Module",
    3: "Namespace",
    4: "Package",
    5: "Class",
    6: "Method",
    7: "Property",
    8: "Field",
    9: "Constructor",
    10: "Enum",
    11: "Interface",
    12: "Function",
    13: "Variable",
    14: "Constant",
    15: "String",
    16: "Number",
    17: "Boolean",
    18: "Array",
    19: "Object",
    20: "Key",
    21: "Null",
    22: "EnumMember",
    23: "Struct",
    24: "Event",
    25: "Operator",
    26: "TypeParameter",
  };

  let result = `Found ${data.length} symbol${data.length === 1 ? "" : "s"}:\n\n`;

  function formatSymbol(symbol: any, indent: number = 0): string {
    const kind = kindMap[symbol.kind] || "Unknown";
    const line = symbol.location?.range?.start?.line
      ? ` (line ${symbol.location.range.start.line + 1})`
      : symbol.range?.start?.line
        ? ` (line ${symbol.range.start.line + 1})`
        : "";

    let str = "  ".repeat(indent) + `${kind}: ${symbol.name}${line}\n`;

    if (symbol.children && symbol.children.length > 0) {
      for (const child of symbol.children) {
        str += formatSymbol(child, indent + 1);
      }
    }

    return str;
  }

  for (const symbol of data) {
    result += formatSymbol(symbol);
  }

  return result.trim();
}

/**
 * Format outline (tree view of symbols)
 */
function formatOutline(data: any, context?: any): string {
  if (!data || !Array.isArray(data)) {
    return "No outline available";
  }

  if (data.length === 0) {
    return "No outline available";
  }

  let result = "";
  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    result += `Outline for ${filePath}:\n`;
    result += "─".repeat(50) + "\n\n";
  }

  function formatNode(
    symbol: any,
    indent: number = 0,
    isLast: boolean = false,
    prefix: string = "",
  ): string {
    const connector = isLast ? "└── " : "├── ";
    const line = symbol.location?.range?.start?.line
      ? `:${symbol.location.range.start.line + 1}`
      : symbol.range?.start?.line
        ? `:${symbol.range.start.line + 1}`
        : "";

    let str = prefix + connector + symbol.name + line + "\n";

    if (symbol.children && symbol.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      for (let i = 0; i < symbol.children.length; i++) {
        const child = symbol.children[i];
        const isChildLast = i === symbol.children.length - 1;
        str += formatNode(child, indent + 1, isChildLast, childPrefix);
      }
    }

    return str;
  }

  for (let i = 0; i < data.length; i++) {
    const symbol = data[i];
    const isLast = i === data.length - 1;
    result += formatNode(symbol, 0, isLast, "");
  }

  return result.trim();
}

/**
 * Main formatter function
 */
export function formatOutput(
  commandType: string,
  data: any,
  context?: any,
): string {
  switch (commandType) {
    case "definition":
    case "typeDefinition":
      if (!data) return "No definition found";
      // Handle object with numeric keys (from daemon response)
      if (data["0"]) {
        return formatLocation(data["0"], context);
      }
      if (Array.isArray(data) && data.length === 0)
        return "No definition found";
      const location = Array.isArray(data) ? data[0] : data;
      return formatLocation(location, context);

    case "references":
      return formatReferences(data, context);

    case "implementation":
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return "No implementations found";
      }
      return formatReferences(data, { ...context, groupByFile: true });

    case "hover":
      return formatHover(data, context);

    case "diagnostics":
      return formatDiagnostics(data, context);

    case "symbols":
      // Handle wrapped response from daemon
      if (data && data.symbols) {
        return formatSymbols(data.symbols, context);
      }
      return formatSymbols(data, context);

    case "outline":
      // Handle wrapped response from daemon
      if (data && data.symbols) {
        return formatOutline(data.symbols, context);
      }
      return formatOutline(data, context);

    case "rename":
      if (!data) return "No rename edits generated";
      if (context?.preview) {
        return formatRenamePreview(data, context);
      }
      if (context?.write) {
        return "Rename applied successfully";
      }
      return JSON.stringify(data, null, 2);

    case "organize-imports":
      if (context?.preview) {
        return formatOrganizeImportsPreview(data, context);
      }
      if (context?.write) {
        return "Imports organized successfully";
      }
      return JSON.stringify(data, null, 2);

    case "analyze-changed":
      return formatAnalyzeChanged(data, context);

    default:
      // Fallback to JSON for unknown command types
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Format rename preview
 */
function formatRenamePreview(data: any, context: any): string {
  if (!data || !data.changes) {
    return "No changes to preview";
  }

  let result = `Rename preview: ${context.newName}\n`;
  result += "─".repeat(50) + "\n\n";

  const changes = data.changes;
  const fileCount = Object.keys(changes).length;
  let totalChanges = 0;

  for (const [uri, edits] of Object.entries(changes)) {
    totalChanges += (edits as any[]).length;
  }

  result += `${totalChanges} change${totalChanges === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}:\n\n`;

  for (const [uri, edits] of Object.entries(changes)) {
    const filePath = formatFilePath(uri, context.projectRoot);
    result += `${filePath} (${(edits as any[]).length} change${(edits as any[]).length === 1 ? "" : "s"}):\n`;

    for (const edit of edits as any[]) {
      const line = edit.range.start.line + 1;
      const col = edit.range.start.character + 1;
      result += `  ${line}:${col} - Replace "${edit.newText || context.newName}"\n`;
    }
    result += "\n";
  }

  return result.trim();
}

/**
 * Format organize imports preview
 */
function formatOrganizeImportsPreview(data: any, context: any): string {
  if (!data || !data.changes) {
    return "No import changes needed";
  }

  let result = "Organize imports preview:\n";
  result += "─".repeat(50) + "\n\n";

  const changes = data.changes;
  for (const [uri, edits] of Object.entries(changes)) {
    const filePath = formatFilePath(uri, context.projectRoot);
    result += `${filePath}:\n`;
    result += "  Imports will be organized and sorted\n";
    result += `  ${(edits as any[]).length} edit${(edits as any[]).length === 1 ? "" : "s"} will be applied\n`;
    result += "\n";
  }

  return result.trim();
}

/**
 * Format analyze changed output
 */
function formatAnalyzeChanged(data: any, context?: any): string {
  if (!data || !data.files) {
    return "No changed files to analyze";
  }

  const files = data.files;
  if (files.length === 0) {
    return "No changed files to analyze";
  }

  let result = `Analyzing ${files.length} changed file${files.length === 1 ? "" : "s"}`;
  if (context?.staged) {
    result += " (staged only)";
  }
  result += ":\n";
  result += "─".repeat(50) + "\n\n";

  let totalIssues = 0;

  for (const file of files) {
    const issueCount = file.diagnostics?.length || 0;
    totalIssues += issueCount;

    result += `${file.path}:\n`;
    if (issueCount === 0) {
      result += "  ✓ No issues\n";
    } else {
      result += `  ${issueCount} issue${issueCount === 1 ? "" : "s"}\n`;
      if (file.diagnostics) {
        for (const diag of file.diagnostics.slice(0, 3)) {
          const line = diag.range.start.line + 1;
          result += `    ${line}: ${diag.message}\n`;
        }
        if (file.diagnostics.length > 3) {
          result += `    ... and ${file.diagnostics.length - 3} more\n`;
        }
      }
    }
    result += "\n";
  }

  result += "─".repeat(50) + "\n";
  result += `Total: ${totalIssues} issue${totalIssues === 1 ? "" : "s"} in ${files.length} file${files.length === 1 ? "" : "s"}`;

  return result.trim();
}
