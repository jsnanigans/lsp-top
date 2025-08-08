#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import { spawn, execSync } from "child_process";
import { setLogLevel, setTraceFlags, Level, LOG_FILE } from "./logger";
import { printJsonAndExit, printTextAndExit, result } from "./errors";
import { resolveProject } from "./project-utils";
import { formatOutput } from "./output-formatter";

const SOCKET_PATH = "/tmp/lsp-top.sock";
const PID_FILE = "/tmp/lsp-top.pid";
const SCHEMA_VERSION = "1.0.0";

/**
 * Check if daemon is running
 */
function isDaemonRunning(): boolean {
  try {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
    if (isNaN(pid)) return false;
    // Check if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start daemon if not running
 */
function ensureDaemonRunning(options: any = {}): void {
  if (isDaemonRunning()) return;

  const args: string[] = [];
  if (options.verbose) args.push("--verbose");
  if (options.logLevel) args.push("--log-level", String(options.logLevel));
  if (options.trace) args.push("--trace", String(options.trace));

  const daemon = spawn(
    process.argv[0],
    [path.resolve(__dirname, "daemon.js"), ...args],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  daemon.unref();

  // Wait a bit for daemon to start
  let attempts = 0;
  while (!isDaemonRunning() && attempts < 10) {
    execSync("sleep 0.1");
    attempts++;
  }

  if (!isDaemonRunning()) {
    throw new Error("Failed to start daemon");
  }
}

/**
 * Send request to daemon
 */
function sendDaemonRequest(
  request: any,
  options: any,
  onResult: (data: any) => void,
  onError: (error: string) => void,
): void {
  ensureDaemonRunning(options);

  const client = net.connect(SOCKET_PATH, () => {
    client.write(JSON.stringify(request));
  });

  let buffer = "";
  client.on("data", (data) => {
    buffer += data.toString();
    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const chunk = buffer.substring(0, boundary);
      buffer = buffer.substring(boundary + 1);
      if (chunk) {
        try {
          const response = JSON.parse(chunk);
          if (response.type === "log" && options.verbose && !options.json) {
            console.log(response.data);
          } else if (response.type === "result") {
            onResult(response.data);
            client.end();
          } else if (response.type === "error") {
            onError(response.message);
            client.end();
          }
        } catch (e) {
          console.error("Error parsing daemon response:", e);
        }
      }
      boundary = buffer.indexOf("\n");
    }
  });

  client.on("error", () => {
    onError("Failed to connect to daemon");
  });
}

/**
 * Add schema version to JSON output
 */
function wrapJsonOutput(data: any): any {
  // If data already has schemaVersion, replace it with our version
  if (data.schemaVersion) {
    return {
      ...data,
      schemaVersion: SCHEMA_VERSION,
    };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    ...data,
  };
}

/**
 * Handle LSP command response
 */
function handleLspResponse(
  data: any,
  options: any,
  commandType: string,
  context?: any,
): void {
  if (options.json) {
    printJsonAndExit(wrapJsonOutput(result({ ok: true, data })));
  } else {
    // Use the new formatter for human-readable output
    const formatted = formatOutput(commandType, data, context);
    printTextAndExit(formatted);
  }
}

/**
 * Handle LSP command error
 */
function handleLspError(error: string, options: any): void {
  if (options.json) {
    printJsonAndExit(
      wrapJsonOutput(result({ ok: false, error, code: "LSP_ERROR" })),
      "LSP_ERROR",
    );
  } else {
    printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
  }
}

const program = new Command();

program
  .name("lsp-top")
  .description("Language Server Protocol CLI for code intelligence")
  .version("1.0.0")
  .option("-v, --verbose", "Enable verbose logging")
  .option("-q, --quiet", "Suppress non-error output")
  .option("--json", "Output machine-readable JSON only")
  .option("--log-level <level>", "Set log level (error|warn|info|debug|trace)")
  .option("--trace <flags>", "Comma-separated trace flags")
  .option(
    "--preview",
    "Preview changes without applying (for refactoring commands)",
  )
  .option("--write", "Apply changes to disk (for refactoring commands)")
  .addHelpText(
    "after",
    `
Examples:
  # Navigate to definition
  $ lsp-top navigate def src/index.ts:10:5
  
  # Find all references to a symbol
  $ lsp-top navigate refs src/calculator.ts:4:14 --group-by-file
  
  # Get diagnostics for a file
  $ lsp-top analyze file src/index.ts
  
  # Get hover information
  $ lsp-top explore hover src/index.ts:10:5
  
  # List all symbols in a file
  $ lsp-top explore symbols src/index.ts --query "user"
  
  # Preview renaming a symbol
  $ lsp-top refactor rename src/calculator.ts:4:14 Calculator2 --preview
  
  # Check daemon health
  $ lsp-top daemon health

For more help on a specific command:
  $ lsp-top <command> --help
  $ lsp-top <command> <subcommand> --help`,
  );

// ============================================================================
// NAVIGATE Command Group
// ============================================================================
const navigate = program
  .command("navigate")
  .alias("nav")
  .description("Navigate through code relationships")
  .addHelpText(
    "after",
    `
Examples:
  # Go to where a function is defined
  $ lsp-top navigate def src/index.ts:25:10
  
  # Find all places a class is used
  $ lsp-top navigate refs src/models/User.ts:5:14
  
  # Go to type definition of a variable
  $ lsp-top navigate type src/index.ts:10:5
  
  # Find implementations of an interface
  $ lsp-top navigate impl src/interfaces/Service.ts:3:11

Options can be combined:
  $ lsp-top navigate refs src/index.ts:10:5 --group-by-file --limit 10`,
  );

navigate
  .command("def <file:line:col>")
  .alias("definition")
  .description("Go to definition of symbol at position")
  .option("--context <lines>", "Number of context lines to show", "3")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top navigate def src/index.ts:10:5
  $ lsp-top navigate def ./components/Button.tsx:25:10 --context 5
  $ lsp-top nav def src/utils.ts:100:15 --json`,
  )
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "definition",
      projectRoot,
      args: [resolvedFilePath, line, col],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "definition", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          contextLines: parseInt(options.context),
        }),
      (error) => handleLspError(error, options),
    );
  });

navigate
  .command("refs <file:line:col>")
  .alias("references")
  .description("Find all references to symbol at position")
  .option("--include-declaration", "Include the declaration")
  .option("--context <lines>", "Number of context lines to show", "2")
  .option("--group-by-file", "Group results by file")
  .option("--limit <n>", "Limit number of results")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top navigate refs src/calculator.ts:4:14
  $ lsp-top navigate refs src/index.ts:10:5 --group-by-file
  $ lsp-top nav refs src/api.ts:50:20 --limit 10 --include-declaration`,
  )
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      includeDeclaration: !!options.includeDeclaration,
    });

    const request = {
      action: "references",
      projectRoot,
      args: [resolvedFilePath, line, col, flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "references", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          contextLines: parseInt(options.context),
          groupByFile: !!options.groupByFile,
          limit: options.limit ? parseInt(options.limit) : undefined,
        }),
      (error) => handleLspError(error, options),
    );
  });

navigate
  .command("type <file:line:col>")
  .description("Go to type definition")
  .option("--context <lines>", "Number of context lines to show", "3")
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "typeDefinition",
      projectRoot,
      args: [resolvedFilePath, line, col],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "typeDefinition", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          contextLines: parseInt(options.context),
        }),
      (error) => handleLspError(error, options),
    );
  });

navigate
  .command("impl <file:line:col>")
  .alias("implementation")
  .description("Find implementations")
  .option("--context <lines>", "Number of context lines to show", "2")
  .option("--group-by-file", "Group results by file")
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "implementation",
      projectRoot,
      args: [resolvedFilePath, line, col],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "implementation", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          contextLines: parseInt(options.context),
          groupByFile: !!options.groupByFile,
        }),
      (error) => handleLspError(error, options),
    );
  });

// ============================================================================
// EXPLORE Command Group
// ============================================================================
const explore = program
  .command("explore")
  .alias("exp")
  .description("Explore code structure and information")
  .addHelpText(
    "after",
    `
Examples:
  # Get type information for a variable
  $ lsp-top explore hover src/index.ts:10:5
  
  # List all symbols in a file
  $ lsp-top explore symbols src/calculator.ts
  
  # Search for specific symbols
  $ lsp-top explore symbols src/index.ts --query "user"
  
  # Get file outline (hierarchical symbols)
  $ lsp-top explore outline src/components/App.tsx`,
  );

explore
  .command("hover <file:line:col>")
  .description("Show type and documentation at position")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top explore hover src/index.ts:10:5
  $ lsp-top exp hover src/api.ts:25:15 --json`,
  )
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "hover",
      projectRoot,
      args: [resolvedFilePath, line, col],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "hover", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
        }),
      (error) => handleLspError(error, options),
    );
  });

explore
  .command("symbols <file>")
  .description("List document symbols")
  .option("--query <query>", "Filter symbols by name")
  .option(
    "--kind <kind>",
    "Filter by symbol kind (class|function|variable|etc)",
  )
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top explore symbols src/index.ts
  $ lsp-top explore symbols src/calculator.ts --query "add"
  $ lsp-top exp symbols src/api.ts --kind function --json`,
  )
  .action((filePath: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      query: options.query,
      kind: options.kind,
    });

    const request = {
      action: "documentSymbols",
      projectRoot,
      args: [resolvedFilePath, flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "symbols", {
          file: resolvedFilePath,
          query: options.query,
          kind: options.kind,
        }),
      (error) => handleLspError(error, options),
    );
  });

explore
  .command("outline <file>")
  .description("Show file outline")
  .action((filePath: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "documentSymbols",
      projectRoot,
      args: [resolvedFilePath, "{}"],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "outline", {
          file: resolvedFilePath,
        }),
      (error) => handleLspError(error, options),
    );
  });

explore
  .command("project-symbols [query]")
  .alias("ps")
  .description("Search symbols across entire project")
  .option(
    "--project <path>",
    "Project directory or file to find tsconfig.json from",
  )
  .option("--limit <n>", "Limit number of results", "50")
  .option(
    "--kind <kind>",
    "Filter by symbol kind (class|function|variable|etc)",
  )
  .addHelpText(
    "after",
    `
Examples:
  # List all symbols in current project
  $ lsp-top explore project-symbols
  
  # Search in a specific project
  $ lsp-top explore project-symbols --project ~/my-app
  
  # Search for symbols containing "user"
  $ lsp-top explore project-symbols user
  
  # Find all classes in project
  $ lsp-top explore project-symbols --kind class
  
  # Search with limit
  $ lsp-top exp ps "handle" --limit 20`,
  )
  .action((query: string = "", cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    // Use provided project path or current directory
    const searchPath = options.project
      ? path.resolve(options.project)
      : process.cwd();
    const { projectRoot } = resolveProject(searchPath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found from ${searchPath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      query,
      limit: parseInt(options.limit),
      kind: options.kind,
    });

    const request = {
      action: "workspaceSymbols",
      projectRoot,
      args: [flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "workspaceSymbols", {
          projectRoot,
          query,
          limit: parseInt(options.limit),
          kind: options.kind,
        }),
      (error) => handleLspError(error, options),
    );
  });

explore
  .command("call-hierarchy <file:line:col>")
  .alias("calls")
  .description("Show incoming and outgoing calls for a function")
  .option("--direction <dir>", "Direction: in|out|both", "both")
  .option("--depth <n>", "Maximum depth to traverse", "2")
  .addHelpText(
    "after",
    `
Examples:
  # Show all callers of a function
  $ lsp-top explore call-hierarchy src/utils.ts:10:5 --direction in
  
  # Show what a function calls
  $ lsp-top explore calls src/api.ts:25:10 --direction out
  
  # Show both directions with depth
  $ lsp-top exp calls src/service.ts:15:8 --depth 3`,
  )
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      direction: options.direction,
      depth: parseInt(options.depth),
    });

    const request = {
      action: "callHierarchy",
      projectRoot,
      args: [resolvedFilePath, line, col, flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "callHierarchy", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          direction: options.direction,
          depth: parseInt(options.depth),
        }),
      (error) => handleLspError(error, options),
    );
  });

explore
  .command("type-hierarchy <file:line:col>")
  .alias("types")
  .description("Show type hierarchy (supertypes and subtypes)")
  .option("--direction <dir>", "Direction: super|sub|both", "both")
  .addHelpText(
    "after",
    `
Examples:
  # Show what a class extends/implements
  $ lsp-top explore type-hierarchy src/models/User.ts:5:14 --direction super
  
  # Show what extends/implements an interface
  $ lsp-top explore types src/interfaces/Service.ts:3:11 --direction sub
  
  # Show full hierarchy
  $ lsp-top exp types src/base/Component.ts:10:7`,
  )
  .action((location: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      direction: options.direction,
    });

    const request = {
      action: "typeHierarchy",
      projectRoot,
      args: [resolvedFilePath, line, col, flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "typeHierarchy", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          direction: options.direction,
        }),
      (error) => handleLspError(error, options),
    );
  });

// ============================================================================
// ANALYZE Command Group
// ============================================================================
const analyze = program
  .command("analyze")
  .alias("an")
  .description("Analyze code for issues and improvements")
  .addHelpText(
    "after",
    `
Examples:
  # Get diagnostics for a single file
  $ lsp-top analyze file src/index.ts
  
  # Show available quick fixes
  $ lsp-top analyze file src/index.ts --fix
  
  # Analyze all changed files (git)
  $ lsp-top analyze changed
  
  # Analyze changed files in a specific project
  $ lsp-top analyze changed --project ./packages/frontend
  
  # Analyze only staged files
  $ lsp-top analyze changed --staged --fix`,
  );

analyze
  .command("file <file>")
  .description("Analyze a single file for diagnostics")
  .option("--fix", "Show available quick fixes")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top analyze file src/index.ts
  $ lsp-top analyze file ./components/Button.tsx --fix
  $ lsp-top an file src/api.ts --json`,
  )
  .action((filePath: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "diagnostics",
      projectRoot,
      args: [resolvedFilePath],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "diagnostics", {
          file: resolvedFilePath,
          showFixes: !!options.fix,
        }),
      (error) => handleLspError(error, options),
    );
  });

analyze
  .command("changed")
  .description("Analyze changed files (git)")
  .option("--staged", "Only analyze staged files")
  .option("--fix", "Show available quick fixes")
  .option("--project <path>", "Project directory to filter changed files")
  .addHelpText(
    "after",
    `
Examples:
  # Analyze all changed files in repository
  $ lsp-top analyze changed
  
  # Analyze changed files in specific project (monorepo)
  $ lsp-top analyze changed --project ./packages/api
  
  # Analyze only staged files
  $ lsp-top analyze changed --staged
  
  # Show quick fixes for issues
  $ lsp-top analyze changed --fix
  
  # Combine options
  $ lsp-top analyze changed --project ./apps/web --staged --fix`,
  )
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    // Get git root
    let gitRoot: string;
    try {
      gitRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf-8",
      }).trim();
    } catch {
      handleLspError("Not in a git repository", options);
      return;
    }

    // Determine project root if --project is specified
    let targetProjectRoot: string | undefined;
    if (options.project) {
      const searchPath = path.resolve(options.project);
      const { projectRoot } = resolveProject(searchPath);
      if (!projectRoot) {
        handleLspError(`No tsconfig.json found from ${searchPath}`, options);
        return;
      }
      targetProjectRoot = projectRoot;
    }

    // Get changed files
    const gitCmd = options.staged
      ? "git diff --cached --name-only"
      : "git diff --name-only HEAD";

    let changedFiles: string[];
    try {
      changedFiles = execSync(gitCmd, { encoding: "utf-8" })
        .trim()
        .split("\n")
        .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
        .map((f) => path.resolve(gitRoot, f));

      // Filter to only files within the target project if specified
      if (targetProjectRoot) {
        changedFiles = changedFiles.filter((f) => {
          // Check if file is within the project directory
          const relative = path.relative(targetProjectRoot, f);
          return !relative.startsWith("..");
        });
      }
    } catch {
      changedFiles = [];
    }

    if (changedFiles.length === 0) {
      if (options.json) {
        printJsonAndExit(
          wrapJsonOutput(result({ ok: true, data: { files: [] } })),
        );
      } else {
        const message = targetProjectRoot
          ? `No TypeScript files changed in project ${targetProjectRoot}`
          : "No TypeScript files changed";
        printTextAndExit(message);
      }
      return;
    }

    // Process each file
    const results: any[] = [];
    let completed = 0;

    changedFiles.forEach((filePath) => {
      // If --project was specified, use that project root for all files
      // Otherwise, resolve each file's project independently
      let projectRoot: string | null;
      let resolvedFilePath: string;

      if (targetProjectRoot) {
        projectRoot = targetProjectRoot;
        resolvedFilePath = filePath;
      } else {
        const resolved = resolveProject(filePath);
        projectRoot = resolved.projectRoot;
        resolvedFilePath = resolved.resolvedFilePath;
      }

      if (!projectRoot) {
        results.push({
          file: filePath,
          error: "No tsconfig.json found",
        });
        completed++;
        if (completed === changedFiles.length) {
          handleLspResponse({ files: results }, options, "analyze-changed", {
            staged: options.staged,
          });
        }
        return;
      }

      const request = {
        action: "diagnostics",
        projectRoot,
        args: [resolvedFilePath],
        verbose: options.verbose,
        logLevel: options.logLevel,
        trace: options.trace,
      };

      sendDaemonRequest(
        request,
        options,
        (data) => {
          results.push({ file: resolvedFilePath, ...data });
          completed++;
          if (completed === changedFiles.length) {
            handleLspResponse({ files: results }, options, "analyze-changed", {
              staged: options.staged,
            });
          }
        },
        (error) => {
          results.push({ file: resolvedFilePath, error });
          completed++;
          if (completed === changedFiles.length) {
            handleLspResponse({ files: results }, options, "analyze-changed", {
              staged: options.staged,
            });
          }
        },
      );
    });
  });

analyze
  .command("project")
  .description("Analyze entire project for diagnostics")
  .option(
    "--project <path>",
    "Project directory or file to find tsconfig.json from",
  )
  .option(
    "--severity <level>",
    "Minimum severity (error|warning|info|hint)",
    "error",
  )
  .option("--limit <n>", "Limit number of files with issues shown", "20")
  .option("--summary", "Show summary only")
  .addHelpText(
    "after",
    `
Examples:
  # Get all errors in current project
  $ lsp-top analyze project
  
  # Analyze a specific project
  $ lsp-top analyze project --project ~/my-app
  
  # Include warnings
  $ lsp-top analyze project --severity warning
  
  # Get summary of issues
  $ lsp-top analyze project --summary
  
  # Limit output
  $ lsp-top an project --limit 10`,
  )
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    // Use provided project path or current directory
    const searchPath = options.project
      ? path.resolve(options.project)
      : process.cwd();
    const { projectRoot } = resolveProject(searchPath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found from ${searchPath}`;
      handleLspError(msg, options);
      return;
    }

    const flags = JSON.stringify({
      severity: options.severity,
      limit: parseInt(options.limit),
      summary: !!options.summary,
    });

    const request = {
      action: "projectDiagnostics",
      projectRoot,
      args: [flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "projectDiagnostics", {
          projectRoot,
          severity: options.severity,
          limit: parseInt(options.limit),
          summary: !!options.summary,
        }),
      (error) => handleLspError(error, options),
    );
  });

// ============================================================================
// REFACTOR Command Group
// ============================================================================
const refactor = program
  .command("refactor")
  .alias("ref")
  .description("Refactor code safely")
  .addHelpText(
    "after",
    `
Examples:
  # Preview renaming a symbol
  $ lsp-top refactor rename src/calculator.ts:4:14 NewCalculator --preview
  
  # Apply rename to all files
  $ lsp-top refactor rename src/index.ts:10:5 newVariableName --write
  
  # Organize imports in a file
  $ lsp-top refactor organize-imports src/index.ts --preview
  $ lsp-top refactor organize-imports src/index.ts --write

Note: Refactor commands require either --preview or --write flag for safety`,
  );

refactor
  .command("rename <file:line:col> <newName>")
  .description("Rename symbol across project")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top refactor rename src/calculator.ts:4:14 Calculator2 --preview
  $ lsp-top refactor rename src/api.ts:10:5 newFunctionName --write
  
Note: Requires --preview to see changes or --write to apply them`,
  )
  .action((location: string, newName: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    if (!options.preview && !options.write) {
      printTextAndExit(
        "Error: Rename requires either --preview or --write flag for safety",
        true,
        "SAFETY_ERROR",
      );
      return;
    }

    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "rename",
      projectRoot,
      args: [resolvedFilePath, line, col, newName],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "rename", {
          file: resolvedFilePath,
          line: parseInt(line),
          col: parseInt(col),
          newName,
          preview: !!options.preview,
          write: !!options.write,
        }),
      (error) => handleLspError(error, options),
    );
  });

refactor
  .command("organize-imports <file>")
  .description("Organize and clean up imports")
  .action((filePath: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    if (!options.preview && !options.write) {
      printTextAndExit(
        "Error: Organize imports requires either --preview or --write flag for safety",
        true,
        "SAFETY_ERROR",
      );
      return;
    }

    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      handleLspError(msg, options);
      return;
    }

    const request = {
      action: "organizeImports",
      projectRoot,
      args: [resolvedFilePath],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) =>
        handleLspResponse(data, options, "organize-imports", {
          file: resolvedFilePath,
          preview: !!options.preview,
          write: !!options.write,
        }),
      (error) => handleLspError(error, options),
    );
  });

// ============================================================================
// DAEMON Command Group
// ============================================================================
const daemon = program
  .command("daemon")
  .description("Manage the LSP daemon")
  .addHelpText(
    "after",
    `
Examples:
  # Check daemon status
  $ lsp-top daemon status
  
  # Check health of daemon and LSP servers
  $ lsp-top daemon health
  
  # Start the daemon manually
  $ lsp-top daemon start
  
  # Stop the daemon
  $ lsp-top daemon stop
  
  # Restart the daemon (useful after crashes)
  $ lsp-top daemon restart
  
  # View daemon logs
  $ lsp-top daemon logs --tail 20
  $ lsp-top daemon logs --follow

Note: The daemon starts automatically when needed and stops after 5 minutes of inactivity`,
  );

daemon
  .command("start")
  .description("Start the daemon")
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    if (isDaemonRunning()) {
      printTextAndExit("Daemon already running");
      return;
    }
    ensureDaemonRunning(options);
    printTextAndExit("Daemon started");
  });

daemon
  .command("stop")
  .description("Stop the daemon")
  .action(() => {
    if (!isDaemonRunning()) {
      printTextAndExit("Daemon not running");
      return;
    }

    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: "stop" }));
    });

    client.on("data", () => {
      printTextAndExit("Daemon stopped");
      client.end();
    });

    client.on("error", () => {
      printTextAndExit("Failed to stop daemon", true, "DAEMON_ERROR");
    });
  });

daemon
  .command("health")
  .description("Check health of daemon and LSP servers")
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };

    if (!isDaemonRunning()) {
      printTextAndExit("✗ Daemon is not running", true, "DAEMON_ERROR");
      return;
    }

    const request = {
      action: "health",
      projectRoot: process.cwd(), // Dummy value, not used for health check
      verbose: options.verbose,
    };

    sendDaemonRequest(
      request,
      options,
      (data) => {
        if (data.healthy) {
          console.log("✓ Daemon is healthy");
          if (data.sessions) {
            console.log(`Active sessions: ${data.sessions.length}`);
            data.sessions.forEach((session: any) => {
              const status = session.healthy ? "✓" : "✗";
              console.log(`  ${status} ${session.projectRoot}`);
            });
          }
        } else {
          console.log("✗ Daemon is unhealthy");
          if (data.error) {
            console.log(`  Error: ${data.error}`);
          }
          console.log('  Try running "lsp-top daemon restart"');
        }
        process.exit(0);
      },
      (error) => {
        console.error("✗ Failed to check daemon health");
        console.error(`  ${error}`);
        console.log('  Try running "lsp-top daemon restart"');
        process.exit(1);
      },
    );
  });

daemon
  .command("restart")
  .description("Restart the daemon")
  .action(async () => {
    console.log("Stopping daemon...");

    // Stop if running
    if (isDaemonRunning()) {
      const stopClient = net.connect(SOCKET_PATH, () => {
        stopClient.write(JSON.stringify({ action: "stop" }));
      });

      await new Promise<void>((resolve) => {
        stopClient.on("data", () => {
          stopClient.end();
          resolve();
        });
        stopClient.on("error", () => {
          resolve();
        });
      });

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Start daemon
    console.log("Starting daemon...");
    ensureDaemonRunning({});
    console.log("✓ Daemon restarted");
    process.exit(0);
  });

daemon
  .command("status")
  .description("Check daemon status")
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    if (!isDaemonRunning()) {
      if (options.json) {
        printJsonAndExit(
          wrapJsonOutput(result({ ok: false, error: "Daemon not running" })),
        );
      } else {
        printTextAndExit("Daemon not running");
      }
      return;
    }

    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: "status" }));
    });

    client.on("data", (data) => {
      try {
        const info = JSON.parse(data.toString());
        if (options.json) {
          printJsonAndExit(wrapJsonOutput(result({ ok: true, data: info })));
        } else {
          printTextAndExit(`Daemon running: ${info.sessions} active sessions`);
        }
      } catch {
        printTextAndExit("Error getting status", true, "DAEMON_ERROR");
      }
    });

    client.on("error", () => {
      printTextAndExit("Failed to connect to daemon", true, "DAEMON_ERROR");
    });
  });

daemon
  .command("logs")
  .description("View daemon logs")
  .option("--tail <n>", "Show last N lines")
  .option("--follow", "Follow log output")
  .addHelpText(
    "after",
    `
Examples:
  $ lsp-top daemon logs --tail 50
  $ lsp-top daemon logs --follow
  $ lsp-top daemon logs --tail 100 | grep ERROR`,
  )
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    if (!fs.existsSync(LOG_FILE)) {
      printTextAndExit("No log file found");
      return;
    }

    const readAll = () => fs.readFileSync(LOG_FILE, "utf-8").split("\n");
    const output = (lines: string[]) => {
      const filtered = lines.filter(Boolean);
      if (options.tail) {
        const n = parseInt(String(options.tail), 10);
        const start = Math.max(0, filtered.length - (isNaN(n) ? 50 : n));
        filtered.slice(start).forEach((l) => console.log(l));
      } else {
        filtered.forEach((l) => console.log(l));
      }
    };

    if (options.follow) {
      let lastSize = fs.statSync(LOG_FILE).size;
      output(readAll());
      const interval = setInterval(() => {
        try {
          const stat = fs.statSync(LOG_FILE);
          if (stat.size > lastSize) {
            const content = fs.readFileSync(LOG_FILE, "utf-8");
            const lines = content.split("\n");
            output(lines);
            lastSize = stat.size;
          }
        } catch {}
      }, 1000);
      process.on("SIGINT", () => {
        clearInterval(interval);
        process.exit(0);
      });
    } else {
      output(readAll());
    }
  });

// Parse and handle global options
const parsed = program.parse(process.argv);
const globalOpts = parsed.opts();
if (globalOpts.logLevel) setLogLevel(String(globalOpts.logLevel) as Level);
if (globalOpts.trace)
  setTraceFlags(
    String(globalOpts.trace)
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean),
  );
