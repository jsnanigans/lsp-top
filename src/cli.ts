#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import { spawn, execSync } from "child_process";
import { setLogLevel, setTraceFlags, Level, LOG_FILE } from "./logger";
import { resolveProject } from "./project-utils";
import { parsePosition } from "./position-parser";
import * as formatter from "./unix-formatter";

const SOCKET_PATH = "/tmp/lsp-top.sock";
const PID_FILE = "/tmp/lsp-top.pid";

/**
 * Check if daemon is running
 */
function isDaemonRunning(): boolean {
  try {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
    if (isNaN(pid)) return false;
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

  // Wait for daemon to start
  let attempts = 0;
  while (!isDaemonRunning() && attempts < 10) {
    execSync("sleep 0.1");
    attempts++;
  }

  if (!isDaemonRunning()) {
    console.error("lsp-top: error: failed to start daemon");
    process.exit(2);
  }
}

/**
 * Send request to daemon and handle response
 */
function sendRequest(
  request: any,
  options: any,
  commandType: string,
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
          if (response.type === "result") {
            const formatOptions = {
              json: options.json,
              verbose: options.verbose,
              delimiter: options.delimiter,
              noHeaders: options.noHeaders,
              contextLines: options.context ? parseInt(options.context) : 0
            };
            const output = formatter.format(commandType, response.data, formatOptions);
            if (output) {
              console.log(output);
            }
            client.end();
            process.exit(0);
          } else if (response.type === "error") {
            console.error(`lsp-top: error: ${response.message}`);
            client.end();
            process.exit(1);
          }
        } catch (e) {
          console.error("lsp-top: error: invalid daemon response");
          process.exit(2);
        }
      }
      boundary = buffer.indexOf("\n");
    }
  });

  client.on("error", () => {
    console.error("lsp-top: error: failed to connect to daemon");
    process.exit(2);
  });
}

const program = new Command();

// Global options
program
  .name("lsp-top")
  .description("Language Server Protocol CLI")
  .version("1.0.0")
  .option("--json", "Output JSON instead of TSV")
  .option("-v, --verbose", "Include context lines")
  .option("-q, --quiet", "Suppress non-error output")
  .option("--delimiter <char>", "Field delimiter", "\t")
  .option("--no-headers", "Omit column headers")
  .option("--context <n>", "Context lines (implies -v)", "3");

// Definition command
program
  .command("def <position>")
  .description("Go to definition")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const request = {
        action: "definition",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1],
      };

      sendRequest(request, options, "definition");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// References command
program
  .command("refs <position>")
  .description("Find references")
  .option("--include-declaration", "Include the declaration")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const flags = JSON.stringify({
        includeDeclaration: !!options.includeDeclaration,
      });

      const request = {
        action: "references",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1, flags],
      };

      sendRequest(request, options, "references");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Type definition command
program
  .command("type <position>")
  .description("Go to type definition")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const request = {
        action: "typeDefinition",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1],
      };

      sendRequest(request, options, "typeDefinition");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Implementation command
program
  .command("impl <position>")
  .description("Find implementations")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const request = {
        action: "implementation",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1],
      };

      sendRequest(request, options, "implementation");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Hover command
program
  .command("hover <position>")
  .description("Show hover information")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const request = {
        action: "hover",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1],
      };

      sendRequest(request, options, "hover");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Diagnostics/check command
program
  .command("check <file>")
  .description("Check file for diagnostics")
  .action((file: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const { projectRoot, resolvedFilePath } = resolveProject(file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${file}`);
        process.exit(1);
      }

      const request = {
        action: "diagnostics",
        projectRoot,
        args: [resolvedFilePath],
      };

      sendRequest(request, options, "diagnostics");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Symbols command
program
  .command("symbols <file>")
  .description("List symbols in file")
  .option("--query <query>", "Filter symbols by name")
  .option("--kind <kind>", "Filter by symbol kind")
  .action((file: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const { projectRoot, resolvedFilePath } = resolveProject(file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${file}`);
        process.exit(1);
      }

      const flags = JSON.stringify({
        query: options.query,
        kind: options.kind,
      });

      const request = {
        action: "documentSymbols",
        projectRoot,
        args: [resolvedFilePath, flags],
      };

      sendRequest(request, options, "symbols");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Outline command (alias for symbols with tree view)
program
  .command("outline <file>")
  .description("Show file outline")
  .action((file: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const { projectRoot, resolvedFilePath } = resolveProject(file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${file}`);
        process.exit(1);
      }

      const request = {
        action: "documentSymbols",
        projectRoot,
        args: [resolvedFilePath, "{}"],
      };

      sendRequest(request, options, "outline");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Search command (workspace symbols)
program
  .command("search [query]")
  .description("Search symbols in project")
  .option("--project <path>", "Project directory")
  .option("--limit <n>", "Limit results", "50")
  .option("--kind <kind>", "Filter by symbol kind")
  .action((query: string = "", cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const searchPath = options.project ? path.resolve(options.project) : process.cwd();
      const { projectRoot } = resolveProject(searchPath);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found from ${searchPath}`);
        process.exit(1);
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
      };

      sendRequest(request, options, "workspaceSymbols");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Rename command
program
  .command("rename <position> <newName>")
  .description("Rename symbol")
  .option("--dry-run", "Preview changes without applying")
  .action((position: string, newName: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const request = {
        action: "rename",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1, newName],
      };

      sendRequest(request, options, "rename");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Call hierarchy command
program
  .command("calls <position>")
  .description("Show call hierarchy")
  .option("--direction <dir>", "Direction: in|out|both", "both")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const flags = JSON.stringify({
        direction: options.direction,
      });

      const request = {
        action: "callHierarchy",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1, flags],
      };

      sendRequest(request, options, "callHierarchy");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Type hierarchy command
program
  .command("types <position>")
  .description("Show type hierarchy")
  .option("--direction <dir>", "Direction: super|sub|both", "both")
  .action((position: string, cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    try {
      const pos = parsePosition(position);
      const { projectRoot, resolvedFilePath } = resolveProject(pos.file);
      
      if (!projectRoot) {
        console.error(`lsp-top: error: no tsconfig.json found for ${pos.file}`);
        process.exit(1);
      }

      const flags = JSON.stringify({
        direction: options.direction,
      });

      const request = {
        action: "typeHierarchy",
        projectRoot,
        args: [resolvedFilePath, pos.line || 1, pos.column || 1, flags],
      };

      sendRequest(request, options, "typeHierarchy");
    } catch (e: any) {
      console.error(`lsp-top: error: ${e.message}`);
      process.exit(1);
    }
  });

// Daemon commands
const daemon = program.command("daemon").description("Manage LSP daemon");

daemon
  .command("start")
  .description("Start daemon")
  .action(() => {
    if (isDaemonRunning()) {
      console.log("daemon already running");
      process.exit(0);
    }
    ensureDaemonRunning({});
    console.log("daemon started");
  });

daemon
  .command("stop")
  .description("Stop daemon")
  .action(() => {
    if (!isDaemonRunning()) {
      console.log("daemon not running");
      process.exit(0);
    }

    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: "stop" }));
    });

    client.on("data", () => {
      console.log("daemon stopped");
      client.end();
      process.exit(0);
    });

    client.on("error", () => {
      console.error("lsp-top: error: failed to stop daemon");
      process.exit(2);
    });
  });

daemon
  .command("status")
  .description("Check daemon status")
  .action(() => {
    if (!isDaemonRunning()) {
      console.log("daemon not running");
      process.exit(1);
    }

    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: "status" }));
    });

    client.on("data", (data) => {
      try {
        const info = JSON.parse(data.toString());
        console.log(`daemon running: ${info.sessions} sessions`);
        process.exit(0);
      } catch {
        console.error("lsp-top: error: invalid status response");
        process.exit(2);
      }
    });

    client.on("error", () => {
      console.error("lsp-top: error: failed to connect to daemon");
      process.exit(2);
    });
  });

daemon
  .command("restart")
  .description("Restart daemon")
  .action(async () => {
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

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    ensureDaemonRunning({});
    console.log("daemon restarted");
    process.exit(0);
  });

daemon
  .command("logs")
  .description("View daemon logs")
  .option("--tail <n>", "Show last N lines")
  .option("--follow", "Follow log output")
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    if (!fs.existsSync(LOG_FILE)) {
      console.log("no log file found");
      process.exit(0);
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