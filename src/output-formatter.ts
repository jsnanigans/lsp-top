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
 * Format a file path for display with better visual hierarchy
 */
function formatFilePath(uri: string, projectRoot?: string): string {
  const filePath = uri.replace("file://", "");
  if (projectRoot) {
    const relative = path.relative(projectRoot, filePath);
    // If file is outside project, show full path
    if (relative.startsWith("..")) {
      return filePath;
    }
    return relative || filePath;
  }
  return filePath;
}

/**
 * Get file extension and infer file type
 */
function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap: { [key: string]: string } = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".json": "JSON",
    ".md": "Markdown",
    ".css": "CSS",
    ".scss": "SCSS",
    ".html": "HTML",
    ".yml": "YAML",
    ".yaml": "YAML",
  };
  return typeMap[ext] || ext.slice(1).toUpperCase() || "File";
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
    const maxLineNumWidth = String(end).length;

    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const isTarget = lineNum === line + 1;
      const prefix = isTarget ? "→" : " ";
      const lineNumStr = String(lineNum).padStart(maxLineNumWidth);
      result.push(`${prefix} ${lineNumStr} │ ${lines[i]}`);
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
  showFileType: boolean = false,
): string {
  const filePath = formatFilePath(location.uri, context?.projectRoot);
  const line = location.range.start.line + 1;
  const col = location.range.start.character + 1;
  const fileType = showFileType ? getFileType(filePath) : "";

  // Build the location header
  let result = "";
  if (fileType) {
    result += `📄 ${fileType} • `;
  }
  result += `${filePath}:${line}:${col}`;

  if (showContext && context?.contextLines) {
    const lines = getFileContext(
      location.uri,
      location.range.start.line,
      context.contextLines,
    );
    if (lines.length > 0) {
      // Use a cleaner box drawing style
      const boxWidth = Math.max(...lines.map((l) => l.length), 50);
      const topBorder = "╭" + "─".repeat(boxWidth) + "╮";
      const bottomBorder = "╰" + "─".repeat(boxWidth) + "╯";

      result += "\n" + topBorder + "\n";
      result += lines.join("\n");
      result += "\n" + bottomBorder;
    }
  }

  return result;
}

/**
 * Format hover information with enhanced visual design
 */
function formatHover(data: any, context?: any): string {
  if (!data || !data.contents) {
    return "💭 No hover information available";
  }

  let result = "";

  // Add header with file context
  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    const fileType = getFileType(filePath);
    result += `💭 Hover Information\n`;
    result += `   ${fileType} • ${filePath}:${context.line}:${context.col}\n`;
    result += `   ` + "─".repeat(50) + "\n\n";
  }

  // Extract and format hover content
  let content = "";
  if (typeof data.contents === "string") {
    content = data.contents;
  } else if (data.contents.value) {
    // Handle MarkupContent
    content = data.contents.value;
  } else if (Array.isArray(data.contents)) {
    // Handle array of MarkedString
    content = data.contents
      .map((c: any) => (typeof c === "string" ? c : c.value))
      .join("\n");
  }

  // Parse the content to extract type information and documentation
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBlockContent = [];
  let documentation = [];
  let symbolKind = "";

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // End of code block - process it
        if (codeBlockContent.length > 0) {
          const typeInfo = codeBlockContent.join("\n").trim();

          // Detect symbol kind from the type signature
          if (typeInfo.includes("class ")) symbolKind = "Class";
          else if (typeInfo.includes("interface ")) symbolKind = "Interface";
          else if (typeInfo.includes("function ")) symbolKind = "Function";
          else if (typeInfo.includes("const ")) symbolKind = "Constant";
          else if (typeInfo.includes("let ")) symbolKind = "Variable";
          else if (typeInfo.includes("var ")) symbolKind = "Variable";
          else if (typeInfo.includes("type ")) symbolKind = "Type Alias";
          else if (typeInfo.includes("enum ")) symbolKind = "Enum";
          else if (typeInfo.includes("namespace ")) symbolKind = "Namespace";
          else if (typeInfo.includes("module ")) symbolKind = "Module";

          // Format the type signature
          result += `📝 Type Signature\n`;
          if (symbolKind) {
            result += `   ${symbolKind}\n\n`;
          }

          // Add the code block with proper formatting
          const codeLines = typeInfo.split("\n");
          const maxWidth = Math.max(...codeLines.map((l) => l.length), 50);
          const topBorder = "   ╭" + "─".repeat(maxWidth + 2) + "╮";
          const bottomBorder = "   ╰" + "─".repeat(maxWidth + 2) + "╯";

          result += topBorder + "\n";
          for (const codeLine of codeLines) {
            result += `   │ ${codeLine.padEnd(maxWidth)} │\n`;
          }
          result += bottomBorder + "\n";
        }
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    } else if (line.trim() && !line.startsWith("```")) {
      // Documentation text
      documentation.push(line);
    }
  }

  // Add documentation if present
  if (documentation.length > 0) {
    result += "\n📖 Documentation\n";
    for (const docLine of documentation) {
      if (docLine.trim()) {
        result += `   ${docLine.trim()}\n`;
      }
    }
  }

  // If we couldn't parse it properly, fall back to cleaned content
  if (!result.includes("Type Signature") && content.trim()) {
    // Clean up markdown code blocks for terminal display
    const cleaned = content
      .replace(/```(\w+)?\n/g, "")
      .replace(/```/g, "")
      .trim();
    if (cleaned) {
      result += `📝 Information\n`;
      const cleanedLines = cleaned.split("\n");
      for (const line of cleanedLines) {
        if (line.trim()) {
          result += `   ${line}\n`;
        }
      }
    }
  }

  // Add quick actions hint
  if (result.includes("Type Signature")) {
    result += "\n💡 Quick Actions\n";
    result += "   • Use 'navigate def' to go to definition\n";
    result += "   • Use 'navigate refs' to find all references\n";
    result += "   • Use 'navigate type' to see type definition";
  }

  return result.trim();
}

/**
 * Format diagnostics with enhanced visual design
 */
function formatDiagnostics(data: any, context?: any): string {
  // Check for errors in the response
  if (data && data.error) {
    return `❌ Failed to get diagnostics: ${data.error}`;
  }

  // Handle wrapped response from daemon
  const diagnostics = data?.diagnostics || data;

  if (!diagnostics || !Array.isArray(diagnostics)) {
    // Check if this might be due to a server issue
    if (data?.serverStatus === "unhealthy") {
      return '❌ Language server is not responding. Try running "lsp-top daemon restart"';
    }
    return "📋 No diagnostics found";
  }

  if (diagnostics.length === 0) {
    return "✅ No issues found - code looks good!";
  }

  // Group diagnostics by severity
  const errors = diagnostics.filter((d: any) => d.severity === 1);
  const warnings = diagnostics.filter((d: any) => d.severity === 2);
  const info = diagnostics.filter((d: any) => d.severity === 3);
  const hints = diagnostics.filter((d: any) => d.severity === 4);

  let result = "";

  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    const fileType = getFileType(filePath);
    result += `📋 Diagnostics Report\n`;
    result += `   ${fileType} • ${filePath}\n`;
    result += `   ` + "─".repeat(50) + "\n\n";
  }

  // Show summary first for quick overview
  const summaryParts = [];
  if (errors.length > 0)
    summaryParts.push(
      `${errors.length} error${errors.length !== 1 ? "s" : ""}`,
    );
  if (warnings.length > 0)
    summaryParts.push(
      `${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`,
    );
  if (info.length > 0) summaryParts.push(`${info.length} info`);
  if (hints.length > 0)
    summaryParts.push(`${hints.length} hint${hints.length !== 1 ? "s" : ""}`);

  result += `📊 Summary: ${summaryParts.join(", ")}\n\n`;

  if (errors.length > 0) {
    result += `🔴 ERRORS (${errors.length})\n`;
    for (const diag of errors) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `   Line ${line}:${col}\n`;
      result += `   └─ ${diag.message}`;
      if (diag.code) {
        result += ` [${diag.code}]`;
      }
      result += "\n\n";
    }
  }

  if (warnings.length > 0) {
    result += `🟡 WARNINGS (${warnings.length})\n`;
    for (const diag of warnings) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `   Line ${line}:${col}\n`;
      result += `   └─ ${diag.message}`;
      if (diag.code) {
        result += ` [${diag.code}]`;
      }
      result += "\n\n";
    }
  }

  if (info.length > 0) {
    result += `🔵 INFO (${info.length})\n`;
    for (const diag of info) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `   Line ${line}:${col}\n`;
      result += `   └─ ${diag.message}`;
      if (diag.code) {
        result += ` [${diag.code}]`;
      }
      result += "\n\n";
    }
  }

  if (hints.length > 0) {
    result += `💡 HINTS (${hints.length})\n`;
    for (const diag of hints) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `   Line ${line}:${col}\n`;
      result += `   └─ ${diag.message}`;
      if (diag.code) {
        result += ` [${diag.code}]`;
      }
      result += "\n\n";
    }
  }

  return result.trim();
}

/**
 * Format references with enhanced visual design
 */
function formatReferences(data: any, context?: any): string {
  // Convert object with numeric keys to array if needed
  let refs = data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    // Filter out non-numeric keys like 'timing'
    refs = Object.keys(data)
      .filter((key) => !isNaN(Number(key)))
      .map((key) => data[key]);
  }

  if (!refs || !Array.isArray(refs)) {
    return "❌ No references found";
  }

  if (refs.length === 0) {
    return "❌ No references found";
  }

  data = refs; // Use the converted array

  // Group references by file for statistics
  const fileGroups = data.reduce((acc: any, ref: Location) => {
    const file = formatFilePath(ref.uri, context?.projectRoot);
    if (!acc[file]) acc[file] = [];
    acc[file].push(ref);
    return acc;
  }, {});

  const fileCount = Object.keys(fileGroups).length;

  // Build header with statistics
  let result = `🔍 Found ${data.length} reference${data.length === 1 ? "" : "s"}`;
  result += ` in ${fileCount} file${fileCount === 1 ? "" : "s"}\n`;

  // Add file type breakdown if multiple types
  const fileTypes = new Set(Object.keys(fileGroups).map((f) => getFileType(f)));
  if (fileTypes.size > 1) {
    result += `   ${Array.from(fileTypes).join(", ")} files\n`;
  }
  result += "\n";

  if (context?.groupByFile) {
    // Group references by file with better formatting
    for (const [file, refs] of Object.entries(fileGroups)) {
      const fileType = getFileType(file);
      result += `📄 ${fileType} • ${file}\n`;
      result += `   ${(refs as Location[]).length} reference${(refs as Location[]).length === 1 ? "" : "s"}:\n`;

      for (const ref of refs as Location[]) {
        const line = ref.range.start.line + 1;
        const col = ref.range.start.character + 1;
        result += `   • Line ${line}, column ${col}\n`;
      }
      result += "\n";
    }
  } else {
    // List all references with context
    let count = 0;
    for (const ref of data) {
      if (context?.limit && count >= context.limit) {
        const remaining = data.length - count;
        result += `\n📊 ... and ${remaining} more reference${remaining === 1 ? "" : "s"}`;
        break;
      }

      // Add a separator between references for clarity
      if (count > 0) {
        result += "\n";
      }

      const filePath = formatFilePath(ref.uri, context?.projectRoot);
      const fileType = getFileType(filePath);
      const line = ref.range.start.line + 1;
      const col = ref.range.start.character + 1;

      result += `[${count + 1}/${data.length}] ${fileType} • ${filePath}:${line}:${col}\n`;

      // Get context lines
      if (context?.contextLines) {
        const lines = getFileContext(
          ref.uri,
          ref.range.start.line,
          context.contextLines,
        );
        if (lines.length > 0) {
          const boxWidth = Math.max(...lines.map((l) => l.length), 50);
          const topBorder = "╭" + "─".repeat(boxWidth) + "╮";
          const bottomBorder = "╰" + "─".repeat(boxWidth) + "╯";

          result += topBorder + "\n";
          result += lines.join("\n");
          result += "\n" + bottomBorder + "\n";
        }
      }

      count++;
    }
  }

  return result.trim();
}

/**
 * Format symbols with enhanced visual design and context
 */
function formatSymbols(data: any, context?: any): string {
  if (!data || !Array.isArray(data)) {
    return "📝 No symbols found";
  }

  if (data.length === 0) {
    return "📝 No symbols found";
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

  const kindIcons: { [key: number]: string } = {
    5: "🏛", // Class
    6: "⚡", // Method
    7: "📦", // Property
    9: "🔨", // Constructor
    10: "📋", // Enum
    11: "🔷", // Interface
    12: "🔧", // Function
    13: "📌", // Variable
    14: "🔒", // Constant
  };

  // Group symbols by kind
  const symbolsByKind: { [key: string]: any[] } = {};

  function categorizeSymbol(symbol: any) {
    const kind = kindMap[symbol.kind] || "Unknown";
    if (!symbolsByKind[kind]) {
      symbolsByKind[kind] = [];
    }
    symbolsByKind[kind].push(symbol);
  }

  // Categorize all top-level symbols
  data.forEach(categorizeSymbol);

  // Count total symbols including nested
  let totalSymbols = 0;
  function countAllSymbols(symbol: any): number {
    let count = 1;
    if (symbol.children) {
      for (const child of symbol.children) {
        count += countAllSymbols(child);
      }
    }
    return count;
  }
  data.forEach((s) => (totalSymbols += countAllSymbols(s)));

  // Build the output
  let result = `📝 Code Symbols\n`;

  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    const fileType = getFileType(filePath);
    result += `   ${fileType} • ${filePath}\n`;
  }

  result += `   ${data.length} top-level • ${totalSymbols} total\n`;
  result += `   ` + "─".repeat(50) + "\n\n";

  // Read file content for context if available
  let fileLines: string[] = [];
  if (context?.file) {
    try {
      const filePath = context.file.replace("file://", "");
      const content = fs.readFileSync(filePath, "utf-8");
      fileLines = content.split("\n");
    } catch {
      // Ignore errors reading file
    }
  }

  // Helper to get line preview
  function getLinePreview(lineNum: number): string {
    if (fileLines.length > 0 && lineNum >= 0 && lineNum < fileLines.length) {
      const line = fileLines[lineNum].trim();
      // Truncate long lines and clean up
      if (line.length > 50) {
        return line.substring(0, 47) + "...";
      }
      return line;
    }
    return "";
  }

  // Helper to detect if symbol is exported
  function isExported(symbol: any): boolean {
    const line =
      symbol.location?.range?.start?.line ?? symbol.range?.start?.line;
    if (line !== undefined && fileLines.length > 0) {
      const lineContent = fileLines[line] || "";
      return lineContent.includes("export ");
    }
    return false;
  }

  // Sort kinds by importance
  const kindOrder = [
    "Class",
    "Interface",
    "Enum",
    "Function",
    "Constant",
    "Variable",
    "Type",
    "Module",
    "Namespace",
  ];
  const sortedKinds = Object.keys(symbolsByKind).sort((a, b) => {
    const aIndex = kindOrder.indexOf(a);
    const bIndex = kindOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Format each kind group
  for (const kind of sortedKinds) {
    const symbols = symbolsByKind[kind];
    const icon = kindIcons[symbols[0]?.kind] || "•";

    result += `${icon} ${kind}${symbols.length > 1 ? "s" : ""} (${symbols.length})\n`;
    result += "   " + "─".repeat(47) + "\n";

    for (const symbol of symbols) {
      const line = symbol.location?.range?.start?.line
        ? symbol.location.range.start.line + 1
        : symbol.range?.start?.line
          ? symbol.range.start.line + 1
          : 0;

      const col = symbol.location?.range?.start?.character
        ? symbol.location.range.start.character + 1
        : symbol.range?.start?.character
          ? symbol.range.start.character + 1
          : 1;

      const exported = isExported(symbol);
      const exportIcon = exported ? "→" : " ";

      result += `   ${exportIcon} ${symbol.name}`;
      result += ` ${exported ? "" : ""}`;
      result += ` • ${line}:${col}\n`;

      // Add line preview if available
      const preview = getLinePreview(line - 1);
      if (preview) {
        result += `     ${preview}\n`;
      }

      // Show children if any (methods, properties, etc.)
      if (symbol.children && symbol.children.length > 0) {
        const childKinds = new Set<string>(
          symbol.children.map((c: any) => kindMap[c.kind] || "Unknown"),
        );
        const childSummary = Array.from(childKinds)
          .map((k) => {
            const count = symbol.children.filter(
              (c: any) => (kindMap[c.kind] || "Unknown") === k,
            ).length;
            return `${count} ${k.toLowerCase()}${count > 1 ? "s" : ""}`;
          })
          .join(", ");
        result += `     └─ ${childSummary}\n`;
      }

      result += "\n";
    }
  }

  // Add usage hints
  result += "💡 Tips\n";
  result += "   → = exported symbol (public API)\n";
  result += "   Use 'navigate def <file>:<line>:1' to jump to any symbol\n";
  result += "   Use 'explore outline' for hierarchical view";

  return result.trim();
}

/**
 * Format outline (tree view of symbols) with enhanced visual design
 */
function formatOutline(data: any, context?: any): string {
  if (!data || !Array.isArray(data)) {
    return "🗂 No outline available";
  }

  if (data.length === 0) {
    return "🗂 No outline available";
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

  const kindIcons: { [key: number]: string } = {
    5: "🏛", // Class
    6: "⚡", // Method
    7: "📦", // Property
    9: "🔨", // Constructor
    10: "📋", // Enum
    11: "🔷", // Interface
    12: "🔧", // Function
    13: "📌", // Variable
    14: "🔒", // Constant
    22: "•", // EnumMember
  };

  // Count total symbols
  let totalSymbols = 0;
  function countAllSymbols(symbol: any): number {
    let count = 1;
    if (symbol.children) {
      for (const child of symbol.children) {
        count += countAllSymbols(child);
      }
    }
    return count;
  }
  data.forEach((s) => (totalSymbols += countAllSymbols(s)));

  let result = "";
  if (context?.file) {
    const filePath = formatFilePath(context.file, context.projectRoot);
    const fileType = getFileType(filePath);
    result += `🗂 Code Structure\n`;
    result += `   ${fileType} • ${filePath}\n`;
    result += `   ${data.length} top-level • ${totalSymbols} total symbols\n`;
    result += `   ` + "─".repeat(50) + "\n\n";
  } else {
    result += `🗂 Code Structure\n`;
    result += `   ${data.length} top-level • ${totalSymbols} total symbols\n`;
    result += `   ` + "─".repeat(50) + "\n\n";
  }

  // Read file content for export detection if available
  let fileLines: string[] = [];
  if (context?.file) {
    try {
      const filePath = context.file.replace("file://", "");
      const content = fs.readFileSync(filePath, "utf-8");
      fileLines = content.split("\n");
    } catch {
      // Ignore errors reading file
    }
  }

  // Helper to detect if symbol is exported
  function isExported(symbol: any): boolean {
    const line =
      symbol.location?.range?.start?.line ?? symbol.range?.start?.line;
    if (line !== undefined && fileLines.length > 0 && line < fileLines.length) {
      const lineContent = fileLines[line] || "";
      return lineContent.includes("export ");
    }
    return false;
  }

  function formatNode(
    symbol: any,
    indent: number = 0,
    isLast: boolean = false,
    prefix: string = "",
  ): string {
    const connector = isLast ? "└─" : "├─";
    const icon = kindIcons[symbol.kind] || "•";
    const kind = kindMap[symbol.kind] || "";
    const line = symbol.location?.range?.start?.line
      ? symbol.location.range.start.line + 1
      : symbol.range?.start?.line
        ? symbol.range.start.line + 1
        : 0;

    const col = symbol.location?.range?.start?.character
      ? symbol.location.range.start.character + 1
      : symbol.range?.start?.character
        ? symbol.range.start.character + 1
        : 1;

    const exported = isExported(symbol);
    const exportPrefix = exported ? "→ " : "  ";

    let str = prefix + connector + ` ${icon} ${exportPrefix}${symbol.name}`;

    // Add line:column
    if (line > 0) {
      str += ` • ${line}:${col}`;
    }

    // Add kind in parentheses for non-obvious types
    if (kind && !["Variable", "Property", "Method"].includes(kind)) {
      str += ` (${kind})`;
    }

    str += "\n";

    if (symbol.children && symbol.children.length > 0) {
      const childPrefix = prefix + (isLast ? "   " : "│  ");

      // Group children by kind for better readability
      const childrenByKind: { [key: string]: any[] } = {};
      for (const child of symbol.children) {
        const childKind = kindMap[child.kind] || "Unknown";
        if (!childrenByKind[childKind]) {
          childrenByKind[childKind] = [];
        }
        childrenByKind[childKind].push(child);
      }

      // Sort kinds for consistent ordering
      const sortedKinds = Object.keys(childrenByKind).sort((a, b) => {
        const order = [
          "Constructor",
          "Property",
          "Method",
          "Function",
          "EnumMember",
        ];
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      let childIndex = 0;
      const totalChildren = symbol.children.length;

      for (const childKind of sortedKinds) {
        for (const child of childrenByKind[childKind]) {
          childIndex++;
          const isChildLast = childIndex === totalChildren;
          str += formatNode(child, indent + 1, isChildLast, childPrefix);
        }
      }
    }

    return str;
  }

  for (let i = 0; i < data.length; i++) {
    const symbol = data[i];
    const isLast = i === data.length - 1;
    result += formatNode(symbol, 0, isLast, "");
  }

  // Add legend
  result += "\n💡 Legend\n";
  result += "   → = exported (public API)\n";
  result += "   Tree shows hierarchical code structure";

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
      if (!data) return "❌ No definition found";
      // Handle object with numeric keys (from daemon response)
      if (data["0"]) {
        const loc = data["0"];
        const filePath = formatFilePath(loc.uri, context?.projectRoot);
        const fileType = getFileType(filePath);
        let result = `📍 Definition found\n`;
        result += `   ${fileType} file\n\n`;
        result += formatLocation(loc, context, true, false);
        return result;
      }
      if (Array.isArray(data) && data.length === 0)
        return "❌ No definition found";
      const location = Array.isArray(data) ? data[0] : data;
      const filePath = formatFilePath(location.uri, context?.projectRoot);
      const fileType = getFileType(filePath);
      let result = `📍 Definition found\n`;
      result += `   ${fileType} file\n\n`;
      result += formatLocation(location, context, true, false);
      return result;

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

    case "workspaceSymbols":
      return formatWorkspaceSymbols(data, context);

    case "callHierarchy":
      return formatCallHierarchy(data, context);

    case "typeHierarchy":
      return formatTypeHierarchy(data, context);

    case "projectDiagnostics":
      return formatProjectDiagnostics(data, context);

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

  for (const [fileUri, edits] of Object.entries(changes)) {
    const filePath = formatFilePath(fileUri, context.projectRoot);
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
  for (const [fileUri, edits] of Object.entries(changes)) {
    const filePath = formatFilePath(fileUri, context.projectRoot);
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

    // Handle both 'path' and 'file' properties for compatibility
    const filePath = file.path || file.file;
    result += `${filePath}:\n`;
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

/**
 * Format workspace symbols output
 */
function formatWorkspaceSymbols(data: any, context?: any): string {
  if (!data || !data.symbols) {
    return "🔍 No symbols found";
  }

  const symbols = data.symbols;
  if (symbols.length === 0) {
    return context?.query
      ? `🔍 No symbols found matching "${context.query}"`
      : "🔍 No symbols found in workspace";
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

  // Icons for different symbol kinds for better visual scanning
  const kindIcons: { [key: string]: string } = {
    Class: "○",
    Interface: "◇",
    Function: "ƒ",
    Method: "→",
    Property: "•",
    Field: "•",
    Variable: "v",
    Constant: "c",
    Enum: "E",
    EnumMember: "e",
    Constructor: "⊕",
    Module: "M",
    Namespace: "N",
    TypeParameter: "T",
  };

  let result = `🔍 Workspace Symbols`;
  if (context?.query) {
    result += ` matching "${context.query}"`;
  }
  result += `\n`;

  // Show project root
  if (context?.projectRoot) {
    result += `   📁 Project: ${context.projectRoot}\n`;
  }

  result += `   Found ${symbols.length} symbol${symbols.length !== 1 ? "s" : ""}`;
  if (context?.limit && symbols.length === context.limit) {
    result += ` (limited to ${context.limit})`;
  }
  result += "\n";
  result += "   " + "─".repeat(50) + "\n\n";

  // Group symbols by file
  const symbolsByFile: { [key: string]: any[] } = {};
  for (const symbol of symbols) {
    const fileUri = symbol.location?.uri || symbol.uri || "unknown";
    if (!symbolsByFile[fileUri]) {
      symbolsByFile[fileUri] = [];
    }
    symbolsByFile[fileUri].push(symbol);
  }

  // Sort files by number of symbols (most first)
  const sortedFiles = Object.keys(symbolsByFile).sort(
    (a, b) => symbolsByFile[b].length - symbolsByFile[a].length,
  );

  for (const fileUri of sortedFiles) {
    const filePath = formatFilePath(fileUri, context?.projectRoot);
    const fileSymbols = symbolsByFile[fileUri];

    result += `📄 ${filePath} (${fileSymbols.length})\n`;

    for (const symbol of fileSymbols) {
      const kind = kindMap[symbol.kind] || "Unknown";
      const icon = kindIcons[kind] || "•";
      const line = symbol.location?.range?.start?.line
        ? symbol.location.range.start.line + 1
        : symbol.range?.start?.line
          ? symbol.range.start.line + 1
          : 0;

      const col = symbol.location?.range?.start?.character
        ? symbol.location.range.start.character + 1
        : symbol.range?.start?.character
          ? symbol.range.start.character + 1
          : 1;

      result += `   ${icon} ${symbol.name} (${kind}) • ${line}:${col}\n`;

      // Add container info if available
      if (symbol.containerName) {
        result += `     └─ in ${symbol.containerName}\n`;
      }

      // Add detail/signature if available
      if (symbol.detail && symbol.detail !== symbol.name) {
        // Clean up the detail string - remove excessive whitespace and newlines
        const cleanDetail = symbol.detail.replace(/\s+/g, " ").trim();
        // Only show if it adds value (not just repeating the name)
        if (cleanDetail.length > 0 && cleanDetail.length < 80) {
          result += `     └─ ${cleanDetail}\n`;
        }
      }
    }
    result += "\n";
  }

  // Add summary of symbol types found
  const symbolKindCounts: { [key: string]: number } = {};
  for (const symbol of symbols) {
    const kind = kindMap[symbol.kind] || "Unknown";
    symbolKindCounts[kind] = (symbolKindCounts[kind] || 0) + 1;
  }

  if (Object.keys(symbolKindCounts).length > 1) {
    result += "📊 Symbol Types Found\n";
    const sortedKinds = Object.entries(symbolKindCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Show top 5 types
    for (const [kind, count] of sortedKinds) {
      result += `   • ${kind}: ${count}\n`;
    }
    result += "\n";
  }

  result += "💡 Tips\n";
  result += "   • Use --kind to filter by symbol type\n";
  result += "   • Use --limit to control number of results\n";
  result += "   • Use 'navigate def <file>:<line>:<col>' to jump to any symbol";

  return result.trim();
}

/**
 * Format call hierarchy output
 */
function formatCallHierarchy(data: any, context?: any): string {
  if (data?.error) {
    return `❌ ${data.error}`;
  }

  if (!data?.item) {
    return "❌ No call hierarchy available at this position";
  }

  const item = data.item;
  let result = `📞 Call Hierarchy\n`;
  result += `   ${item.name}`;
  if (item.kind) {
    const kindMap: { [key: number]: string } = {
      12: "Function",
      6: "Method",
      9: "Constructor",
    };
    const kind = kindMap[item.kind] || "Symbol";
    result += ` (${kind})`;
  }
  result += "\n";

  const filePath = formatFilePath(item.uri, context?.projectRoot);
  result += `   📄 ${filePath}:${item.range.start.line + 1}:${item.range.start.character + 1}\n`;
  result += "   " + "─".repeat(50) + "\n\n";

  // Format incoming calls
  if (data.incoming && data.incoming.length > 0) {
    result += `⬇️ Incoming Calls (${data.incoming.length})\n`;
    result += "   Who calls this function:\n\n";

    for (const call of data.incoming) {
      const from = call.from;
      const callPath = formatFilePath(from.uri, context?.projectRoot);
      result += `   • ${from.name}\n`;
      result += `     ${callPath}:${from.range.start.line + 1}\n`;

      // Show call locations
      if (call.fromRanges && call.fromRanges.length > 0) {
        result += `     ${call.fromRanges.length} call${call.fromRanges.length !== 1 ? "s" : ""} at line${call.fromRanges.length !== 1 ? "s" : ""}: `;
        const lines = call.fromRanges.map((r: any) => r.start.line + 1);
        result += lines.join(", ") + "\n";
      }
      result += "\n";
    }
  } else if (context?.direction === "in" || context?.direction === "both") {
    result += `⬇️ Incoming Calls\n`;
    result += "   No callers found\n\n";
  }

  // Format outgoing calls
  if (data.outgoing && data.outgoing.length > 0) {
    result += `⬆️ Outgoing Calls (${data.outgoing.length})\n`;
    result += "   What this function calls:\n\n";

    for (const call of data.outgoing) {
      const to = call.to;
      const callPath = formatFilePath(to.uri, context?.projectRoot);
      result += `   • ${to.name}\n`;
      result += `     ${callPath}:${to.range.start.line + 1}\n`;

      // Show call locations
      if (call.fromRanges && call.fromRanges.length > 0) {
        result += `     ${call.fromRanges.length} call${call.fromRanges.length !== 1 ? "s" : ""} at line${call.fromRanges.length !== 1 ? "s" : ""}: `;
        const lines = call.fromRanges.map((r: any) => r.start.line + 1);
        result += lines.join(", ") + "\n";
      }
      result += "\n";
    }
  } else if (context?.direction === "out" || context?.direction === "both") {
    result += `⬆️ Outgoing Calls\n`;
    result += "   No outgoing calls found\n\n";
  }

  return result.trim();
}

/**
 * Format type hierarchy output
 */
function formatTypeHierarchy(data: any, context?: any): string {
  if (data?.error) {
    return `❌ ${data.error}`;
  }

  if (!data?.item) {
    return "❌ No type hierarchy available at this position";
  }

  const item = data.item;
  let result = `🔷 Type Hierarchy\n`;
  result += `   ${item.name}`;
  if (item.kind) {
    const kindMap: { [key: number]: string } = {
      5: "Class",
      11: "Interface",
      10: "Enum",
      23: "Struct",
    };
    const kind = kindMap[item.kind] || "Type";
    result += ` (${kind})`;
  }
  result += "\n";

  const filePath = formatFilePath(item.uri, context?.projectRoot);
  result += `   📄 ${filePath}:${item.range.start.line + 1}:${item.range.start.character + 1}\n`;
  result += "   " + "─".repeat(50) + "\n\n";

  // Format supertypes
  if (data.supertypes && data.supertypes.length > 0) {
    result += `⬆️ Supertypes (${data.supertypes.length})\n`;
    result += "   What this type extends/implements:\n\n";

    for (const supertype of data.supertypes) {
      const typePath = formatFilePath(supertype.uri, context?.projectRoot);
      result += `   • ${supertype.name}\n`;
      result += `     ${typePath}:${supertype.range.start.line + 1}\n\n`;
    }
  } else if (context?.direction === "super" || context?.direction === "both") {
    result += `⬆️ Supertypes\n`;
    result += "   No supertypes found\n\n";
  }

  // Format subtypes
  if (data.subtypes && data.subtypes.length > 0) {
    result += `⬇️ Subtypes (${data.subtypes.length})\n`;
    result += "   What extends/implements this type:\n\n";

    for (const subtype of data.subtypes) {
      const typePath = formatFilePath(subtype.uri, context?.projectRoot);
      result += `   • ${subtype.name}\n`;
      result += `     ${typePath}:${subtype.range.start.line + 1}\n\n`;
    }
  } else if (context?.direction === "sub" || context?.direction === "both") {
    result += `⬇️ Subtypes\n`;
    result += "   No subtypes found\n\n";
  }

  return result.trim();
}

/**
 * Format project diagnostics output
 */
function formatProjectDiagnostics(data: any, context?: any): string {
  if (!data) {
    return "❌ Failed to analyze project";
  }

  // Summary only mode
  if (context?.summary && data.summary) {
    const s = data.summary;
    let result = `📊 Project Diagnostics Summary\n`;

    // Show project root
    if (context?.projectRoot) {
      result += `   📁 Project: ${context.projectRoot}\n`;
    }

    result += "   " + "─".repeat(50) + "\n\n";

    result += `   Files analyzed: ${s.filesAnalyzed}\n`;
    result += `   Files with issues: ${s.filesWithIssues}\n\n`;

    if (s.errors > 0) result += `   🔴 Errors: ${s.errors}\n`;
    if (s.warnings > 0) result += `   🟡 Warnings: ${s.warnings}\n`;
    if (s.info > 0) result += `   🔵 Info: ${s.info}\n`;
    if (s.hints > 0) result += `   💡 Hints: ${s.hints}\n`;

    if (s.filesWithIssues === 0) {
      result += "\n   ✅ Project is clean - no issues found!";
    }

    return result.trim();
  }

  // Full report
  if (!data.files || data.files.length === 0) {
    if (data.summary) {
      return formatProjectDiagnostics(data, { ...context, summary: true });
    }
    return "✅ No issues found in project";
  }

  let result = `📊 Project Diagnostics Report\n`;

  // Show project root
  if (context?.projectRoot) {
    result += `   📁 Project: ${context.projectRoot}\n`;
  }

  if (data.summary) {
    const s = data.summary;
    result += `   ${s.filesWithIssues} of ${s.filesAnalyzed} files have issues\n`;

    const parts = [];
    if (s.errors > 0)
      parts.push(`${s.errors} error${s.errors !== 1 ? "s" : ""}`);
    if (s.warnings > 0)
      parts.push(`${s.warnings} warning${s.warnings !== 1 ? "s" : ""}`);
    if (parts.length > 0) {
      result += `   Total: ${parts.join(", ")}\n`;
    }
  }
  result += "   " + "─".repeat(50) + "\n\n";

  // Sort files by number of issues (most first)
  const sortedFiles = data.files.sort(
    (a: any, b: any) =>
      (b.diagnostics?.length || 0) - (a.diagnostics?.length || 0),
  );

  for (const file of sortedFiles) {
    const filePath = formatFilePath(file.file, context?.projectRoot);
    const diagnostics = file.diagnostics || [];

    // Count by severity
    const errors = diagnostics.filter((d: any) => d.severity === 1).length;
    const warnings = diagnostics.filter((d: any) => d.severity === 2).length;

    result += `📄 ${filePath}\n`;

    const parts = [];
    if (errors > 0) parts.push(`${errors} error${errors !== 1 ? "s" : ""}`);
    if (warnings > 0)
      parts.push(`${warnings} warning${warnings !== 1 ? "s" : ""}`);
    result += `   ${parts.join(", ")}\n\n`;

    // Show first few diagnostics
    const toShow = Math.min(3, diagnostics.length);
    for (let i = 0; i < toShow; i++) {
      const diag = diagnostics[i];
      const icon =
        diag.severity === 1 ? "🔴" : diag.severity === 2 ? "🟡" : "🔵";
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      result += `   ${icon} ${line}:${col} - ${diag.message}\n`;
    }

    if (diagnostics.length > toShow) {
      result += `   ... and ${diagnostics.length - toShow} more\n`;
    }
    result += "\n";
  }

  if (context?.limit && data.files.length === context.limit) {
    result += `\n💡 Showing first ${context.limit} files. More files may have issues.`;
  }

  return result.trim();
}
