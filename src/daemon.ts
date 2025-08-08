import * as net from "net";
import * as fs from "fs";
import { TypeScriptLSP } from "./servers/typescript";
import {
  log,
  setLogLevel,
  setTraceFlags,
  loggerEmitter,
  clearLogFile,
  Level,
} from "./logger";

const SOCKET_PATH = "/tmp/lsp-top.sock";
const PID_FILE = "/tmp/lsp-top.pid";
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface LSPRequest {
  action: string;
  projectRoot?: string;
  args: string[];
  verbose?: boolean;
  logLevel?: string;
  trace?: string;
}

interface ProjectSession {
  lsp: TypeScriptLSP;
  lastActivity: number;
}

class Daemon {
  private server: net.Server;
  private projects: Map<string, ProjectSession> = new Map();
  private inactivityTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  start() {
    clearLogFile();

    // Clean up any existing daemon
    if (fs.existsSync(PID_FILE)) {
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
        if (!isNaN(pid)) {
          try {
            process.kill(pid, 0);
            // Daemon already running, exit
            process.exit(0);
          } catch {
            // Process doesn't exist, clean up
          }
        }
        fs.unlinkSync(PID_FILE);
      } catch {}
    }

    if (fs.existsSync(SOCKET_PATH)) {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch {}
    }

    this.server.listen(SOCKET_PATH, () => {
      fs.writeFileSync(PID_FILE, String(process.pid));
      log("info", "Daemon started", { socket: SOCKET_PATH });
      this.resetInactivityTimer();
    });

    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      log("info", "Daemon shutting down due to inactivity");
      this.stop();
    }, INACTIVITY_TIMEOUT);
  }

  async stop() {
    log("info", "Stopping daemon");

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Stop all LSP sessions
    for (const [projectRoot, session] of this.projects.entries()) {
      log("info", "Stopping LSP session", { projectRoot });
      await session.lsp.stop();
    }
    this.projects.clear();

    this.server.close(() => {
      try {
        if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
      } catch {}
      try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      } catch {}
      log("info", "Daemon stopped");
      process.exit(0);
    });
  }

  private async getOrCreateLSP(projectRoot: string): Promise<TypeScriptLSP> {
    // Reset inactivity timer on any activity
    this.resetInactivityTimer();

    if (!projectRoot) {
      throw new Error("Project root is required");
    }

    // Check if we already have a session for this project
    const existing = this.projects.get(projectRoot);
    if (existing) {
      existing.lastActivity = Date.now();
      return existing.lsp;
    }

    // Create new LSP session
    log("info", "Creating new LSP session", { projectRoot });
    const lsp = new TypeScriptLSP(projectRoot);
    await lsp.start();

    this.projects.set(projectRoot, {
      lsp,
      lastActivity: Date.now(),
    });

    // Trigger workspace indexing by opening tsconfig if it exists
    const tsconfigPath = require("path").join(projectRoot, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      try {
        await lsp.getDocumentSymbols(tsconfigPath);
      } catch {
        // Ignore errors, this is just for warming up
      }
    }

    return lsp;
  }

  private async handleConnection(socket: net.Socket) {
    let logListener: ((message: string) => void) | null = null;

    socket.on("data", async (data) => {
      try {
        const request = JSON.parse(data.toString()) as LSPRequest;
        log("debug", "Received request", { request });

        // Reset inactivity timer
        this.resetInactivityTimer();

        // Handle logging configuration
        if (typeof request.logLevel === "string")
          setLogLevel(request.logLevel as Level);
        if (typeof request.trace === "string" && request.trace)
          setTraceFlags(
            String(request.trace)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );

        // Handle special daemon commands
        if (request.action === "stop") {
          socket.write("OK\n");
          socket.end();
          await this.stop();
          return;
        }

        if (request.action === "status") {
          socket.write(
            JSON.stringify({
              ok: true,
              sessions: this.projects.size,
              projects: Array.from(this.projects.keys()),
            }) + "\n",
          );
          socket.end();
          return;
        }

        // All other commands require a project root
        if (!request.projectRoot) {
          socket.write(
            JSON.stringify({
              type: "error",
              message: "No project root provided",
            }) + "\n",
          );
          socket.end();
          return;
        }

        // Set up verbose logging if requested
        if (request.verbose) {
          logListener = (message: string) => {
            socket.write(JSON.stringify({ type: "log", data: message }) + "\n");
          };
          loggerEmitter.on("log", logListener);
        }

        // Get or create LSP session for this project
        const lsp = await this.getOrCreateLSP(request.projectRoot);

        // Handle the LSP action
        const result = await this.handleLSPAction(lsp, request);

        socket.write(JSON.stringify({ type: "result", data: result }) + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", "Request handling error", { error: message });
        socket.write(
          JSON.stringify({
            type: "error",
            message,
            code: "LSP_ERROR",
          }) + "\n",
        );
      } finally {
        if (logListener) {
          loggerEmitter.removeListener("log", logListener);
        }
        socket.end();
      }
    });

    socket.on("error", (err) => {
      log("error", "Socket error", { error: err.message });
    });
  }

  private async handleLSPAction(
    lsp: TypeScriptLSP,
    request: LSPRequest,
  ): Promise<any> {
    const { action, args } = request;
    const startTime = Date.now();
    const timer = () => Date.now() - startTime;

    try {
      switch (action) {
        case "definition": {
          const [file, line, col] = args;
          const result = await lsp.getDefinition(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );
          return { ...result, timing: timer() };
        }

        case "references": {
          const [file, line, col, flags] = args;
          const options = flags ? JSON.parse(flags) : {};
          const result = await lsp.getReferences(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
            options.includeDeclaration,
          );
          return { ...result, timing: timer() };
        }

        case "diagnostics": {
          const [file] = args;
          try {
            const result = await lsp.getDiagnostics(file);
            return { ...result, timing: timer() };
          } catch (error) {
            const errorMessage = String(error);
            log("error", "Failed to get diagnostics", {
              file,
              error: errorMessage,
            });

            // Provide user-friendly error messages
            if (
              errorMessage.includes("ENOENT") ||
              errorMessage.includes("no such file")
            ) {
              return {
                error: `File not found: ${require("path").basename(file)}`,
                diagnostics: [],
                timing: timer(),
              };
            }

            return {
              error: `Failed to get diagnostics: ${errorMessage}`,
              diagnostics: [],
              serverStatus: "unhealthy",
              timing: timer(),
            };
          }
        }

        case "hover": {
          const [file, line, col] = args;
          const result = await lsp.getHover(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );
          return { ...result, timing: timer() };
        }

        case "documentSymbols": {
          const [file, flags] = args;
          const options = flags ? JSON.parse(flags) : {};
          let result = await lsp.getDocumentSymbols(file);

          // Filter symbols if query provided
          if (options.query) {
            result = this.filterSymbols(result, options.query.toLowerCase());
          }

          return { symbols: result, timing: timer() };
        }

        case "typeDefinition": {
          const [file, line, col] = args;
          const result = await lsp.getTypeDefinition(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );
          return { ...result, timing: timer() };
        }

        case "implementation": {
          const [file, line, col] = args;
          const result = await lsp.getImplementation(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );
          return { ...result, timing: timer() };
        }

        case "rename": {
          const [file, line, col, newName] = args;
          const result = await lsp.rename(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
            newName,
          );
          return { ...result, timing: timer() };
        }

        case "organizeImports": {
          const [file] = args;
          const result = await lsp.organizeImports(file);
          return { ...result, timing: timer() };
        }

        case "inspect:file": {
          const [file, flags] = args;
          const options = flags ? JSON.parse(flags) : {};
          const result = await lsp.inspectFile(file, options);
          return { ...result, timing: timer() };
        }

        case "inspect:changed": {
          const [flags] = args;
          const options = flags ? JSON.parse(flags) : {};
          const result = await lsp.inspectChanged(options);
          return { files: result, timing: timer() };
        }

        case "edit:plan": {
          const [editJson] = args;
          const edit = JSON.parse(editJson);
          // For now, just return the edit as-is for planning
          return { edit, timing: timer() };
        }

        case "edit:apply": {
          const [editJson] = args;
          // Use the public method for applying edits
          const result = await lsp.applyWorkspaceEditJson(editJson);
          return { ...result, timing: timer() };
        }

        case "workspaceSymbols": {
          const [flags] = args;
          const options = flags ? JSON.parse(flags) : {};
          const result = await lsp.getWorkspaceSymbols(options.query || "");

          // Filter by kind if specified
          let symbols = result;
          if (options.kind) {
            symbols = this.filterSymbolsByKind(symbols, options.kind);
          }

          // Apply limit
          if (options.limit && symbols.length > options.limit) {
            symbols = symbols.slice(0, options.limit);
          }

          return { symbols, timing: timer() };
        }

        case "callHierarchy": {
          const [file, line, col, flags] = args;
          const options = flags ? JSON.parse(flags) : {};

          // Prepare call hierarchy item
          const prepareResult = await lsp.prepareCallHierarchy(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );

          if (!prepareResult || prepareResult.length === 0) {
            return {
              error: "No call hierarchy available at this position",
              timing: timer(),
            };
          }

          const item = prepareResult[0];
          const result: any = { item };

          // Get incoming calls if requested
          if (options.direction === "in" || options.direction === "both") {
            result.incoming = await lsp.getIncomingCalls(item);
          }

          // Get outgoing calls if requested
          if (options.direction === "out" || options.direction === "both") {
            result.outgoing = await lsp.getOutgoingCalls(item);
          }

          return { ...result, timing: timer() };
        }

        case "typeHierarchy": {
          const [file, line, col, flags] = args;
          const options = flags ? JSON.parse(flags) : {};

          // Prepare type hierarchy item
          const prepareResult = await lsp.prepareTypeHierarchy(
            file,
            parseInt(line, 10),
            parseInt(col, 10),
          );

          if (!prepareResult || prepareResult.length === 0) {
            return {
              error: "No type hierarchy available at this position",
              timing: timer(),
            };
          }

          const item = prepareResult[0];
          const result: any = { item };

          // Get supertypes if requested
          if (options.direction === "super" || options.direction === "both") {
            result.supertypes = await lsp.getSupertypes(item);
          }

          // Get subtypes if requested
          if (options.direction === "sub" || options.direction === "both") {
            result.subtypes = await lsp.getSubtypes(item);
          }

          return { ...result, timing: timer() };
        }

        case "projectDiagnostics": {
          const [flags] = args;
          const options = flags ? JSON.parse(flags) : {};

          // Get all TypeScript files in project
          const files = await lsp.getAllTypeScriptFiles();
          const diagnosticsMap = new Map<string, any[]>();
          let totalErrors = 0;
          let totalWarnings = 0;
          let totalInfo = 0;
          let totalHints = 0;

          // Collect diagnostics for all files
          for (const file of files) {
            try {
              const result = await lsp.getDiagnostics(file);
              if (result.diagnostics && result.diagnostics.length > 0) {
                // Filter by severity
                const filtered = this.filterDiagnosticsBySeverity(
                  result.diagnostics,
                  options.severity,
                );

                if (filtered.length > 0) {
                  diagnosticsMap.set(file, filtered);

                  // Count by severity
                  for (const diag of filtered) {
                    switch (diag.severity) {
                      case 1:
                        totalErrors++;
                        break;
                      case 2:
                        totalWarnings++;
                        break;
                      case 3:
                        totalInfo++;
                        break;
                      case 4:
                        totalHints++;
                        break;
                    }
                  }
                }
              }
            } catch (error) {
              log("warn", "Failed to get diagnostics for file", {
                file,
                error: String(error),
              });
            }
          }

          // Prepare result
          if (options.summary) {
            return {
              summary: {
                filesAnalyzed: files.length,
                filesWithIssues: diagnosticsMap.size,
                errors: totalErrors,
                warnings: totalWarnings,
                info: totalInfo,
                hints: totalHints,
              },
              timing: timer(),
            };
          }

          // Convert map to array and apply limit
          let filesWithIssues = Array.from(diagnosticsMap.entries()).map(
            ([file, diagnostics]) => ({ file, diagnostics }),
          );

          if (options.limit && filesWithIssues.length > options.limit) {
            filesWithIssues = filesWithIssues.slice(0, options.limit);
          }

          return {
            files: filesWithIssues,
            summary: {
              filesAnalyzed: files.length,
              filesWithIssues: diagnosticsMap.size,
              errors: totalErrors,
              warnings: totalWarnings,
              info: totalInfo,
              hints: totalHints,
            },
            timing: timer(),
          };
        }

        case "health": {
          const sessions: Array<{ projectRoot: string; healthy: boolean }> = [];
          for (const [root, session] of this.projects) {
            const healthy = await session.lsp.checkHealth();
            sessions.push({ projectRoot: root, healthy });
          }
          return {
            healthy: true,
            sessions,
            timing: timer(),
          };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      log("error", "LSP action error", {
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private filterSymbols(symbols: any[], query: string): any[] {
    const result: any[] = [];

    for (const symbol of symbols) {
      // Check if symbol name matches query
      if (symbol.name && symbol.name.toLowerCase().includes(query)) {
        result.push(symbol);
      }

      // Recursively filter children if they exist
      if (symbol.children && Array.isArray(symbol.children)) {
        const filteredChildren = this.filterSymbols(symbol.children, query);
        if (filteredChildren.length > 0) {
          // Include parent if any children match
          if (!result.includes(symbol)) {
            result.push({
              ...symbol,
              children: filteredChildren,
            });
          }
        }
      }
    }

    return result;
  }

  private filterSymbolsByKind(symbols: any[], kind: string): any[] {
    const kindMap: Record<string, number> = {
      file: 1,
      module: 2,
      namespace: 3,
      package: 4,
      class: 5,
      method: 6,
      property: 7,
      field: 8,
      constructor: 9,
      enum: 10,
      interface: 11,
      function: 12,
      variable: 13,
      constant: 14,
      string: 15,
      number: 16,
      boolean: 17,
      array: 18,
      object: 19,
      key: 20,
      null: 21,
      enummember: 22,
      struct: 23,
      event: 24,
      operator: 25,
      typeparameter: 26,
    };

    const targetKind = kindMap[kind.toLowerCase()];
    if (!targetKind) return symbols;

    return symbols.filter((symbol) => symbol.kind === targetKind);
  }

  private filterDiagnosticsBySeverity(
    diagnostics: any[],
    severity: string,
  ): any[] {
    const severityMap: Record<string, number> = {
      error: 1,
      warning: 2,
      info: 3,
      hint: 4,
    };

    const minSeverity = severityMap[severity.toLowerCase()] || 1;
    return diagnostics.filter((d) => d.severity && d.severity <= minSeverity);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--log-level" && args[i + 1]) {
    setLogLevel(args[i + 1] as Level);
    i++;
  } else if (args[i] === "--trace" && args[i + 1]) {
    setTraceFlags(
      args[i + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    i++;
  } else if (args[i] === "--verbose" || args[i] === "-v") {
    setLogLevel("debug");
  }
}

// Start the daemon
const daemon = new Daemon();
daemon.start();
