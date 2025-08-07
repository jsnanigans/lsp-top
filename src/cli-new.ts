#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import { spawn, execSync } from "child_process";
import { setLogLevel, setTraceFlags, Level, LOG_FILE } from "./logger";
import { printJsonAndExit, printTextAndExit, result } from "./errors";
import { resolveProject } from "./project-utils";

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
    [path.resolve(__dirname, "daemon-new.js"), ...args],
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

const program = new Command();

program
  .name("lsp-top")
  .description("Language Server Protocol CLI for code intelligence")
  .version(
    (() => {
      try {
        return (
          JSON.parse(
            fs.readFileSync(
              path.resolve(__dirname, "../package.json"),
              "utf-8",
            ),
          ).version || "0.0.0"
        );
      } catch {
        return "0.0.0";
      }
    })(),
  )
  .option("-v, --verbose", "Enable verbose logging")
  .option("-q, --quiet", "Suppress non-error output")
  .option("--json", "Output machine-readable JSON only")
  .option("--log-level <level>", "Set log level (error|warn|info|debug|trace)")
  .option("--trace <flags>", "Comma-separated trace flags");

// Core LSP commands
program
  .command("definition <file:line:col>")
  .alias("def")
  .description("Go to definition")
  .action((location: string, options) => {
    options = { ...program.opts(), ...options };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
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
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

program
  .command("references <file:line:col>")
  .alias("refs")
  .description("Find references")
  .option("--include-declaration", "Include the declaration")
  .action((location: string, options) => {
    options = { ...program.opts(), ...options };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
      return;
    }

    const flags = options.includeDeclaration
      ? JSON.stringify({ includeDeclaration: true })
      : "{}";

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
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

program
  .command("diagnostics <file>")
  .description("Get diagnostics for a file")
  .action((filePath: string, options) => {
    options = { ...program.opts(), ...options };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
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
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

program
  .command("hover <file:line:col>")
  .description("Get hover information")
  .action((location: string, options) => {
    options = { ...program.opts(), ...options };
    const [filePath, line, col] = location.split(":");
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
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
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

program
  .command("symbols <file>")
  .description("Get document symbols")
  .option("--query <query>", "Filter symbols by name")
  .action((filePath: string, options) => {
    options = { ...program.opts(), ...options };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
      return;
    }

    const flags = options.query
      ? JSON.stringify({ query: options.query })
      : "{}";

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
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

// Inspection commands
program
  .command("inspect <file>")
  .description("Inspect file for diagnostics and fixes")
  .option("--fix", "Apply quick fixes")
  .option("--fix-dry", "Plan fixes without applying")
  .option("--organize-imports", "Organize imports")
  .option("--format", "Format file")
  .option("--write", "Apply edits to disk")
  .action((filePath: string, options) => {
    options = { ...program.opts(), ...options };
    const { projectRoot, resolvedFilePath } = resolveProject(filePath);

    if (!projectRoot) {
      const msg = `No tsconfig.json found for ${filePath}`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
      return;
    }

    const flags = JSON.stringify({
      fix: !!options.fix,
      fixDry: !!options.fixDry,
      organizeImports: !!options.organizeImports,
      format: !!options.format,
      write: !!options.write,
    });

    const request = {
      action: "inspect:file",
      projectRoot,
      args: [resolvedFilePath, flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

program
  .command("inspect-changed")
  .description("Inspect changed files")
  .option("--staged", "Only staged files")
  .option("--fix", "Apply quick fixes")
  .option("--write", "Apply edits to disk")
  .action((options) => {
    options = { ...program.opts(), ...options };
    // Use current directory to find project
    const { projectRoot } = resolveProject(process.cwd());

    if (!projectRoot) {
      const msg = `No tsconfig.json found in current directory`;
      if (options.json) {
        printJsonAndExit(
          result({ ok: false, error: msg, code: "NO_PROJECT" }),
          "NO_PROJECT",
        );
      } else {
        printTextAndExit(`Error: ${msg}`, true, "NO_PROJECT");
      }
      return;
    }

    const flags = JSON.stringify({
      staged: !!options.staged,
      fix: !!options.fix,
      write: !!options.write,
    });

    const request = {
      action: "inspect:changed",
      projectRoot,
      args: [flags],
      verbose: options.verbose,
      logLevel: options.logLevel,
      trace: options.trace,
    };

    sendDaemonRequest(
      request,
      options,
      (data) => {
        if (options.json) {
          printJsonAndExit(result({ ok: true, data }));
        } else {
          printTextAndExit(JSON.stringify(data, null, 2));
        }
      },
      (error) => {
        if (options.json) {
          printJsonAndExit(
            result({ ok: false, error, code: "LSP_ERROR" }),
            "LSP_ERROR",
          );
        } else {
          printTextAndExit(`Error: ${error}`, true, "LSP_ERROR");
        }
      },
    );
  });

// Daemon management (mostly hidden from users)
program
  .command("stop-daemon")
  .description("Stop the LSP daemon")
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

program
  .command("daemon-status")
  .description("Check daemon status")
  .action((options) => {
    options = { ...program.opts(), ...options };
    if (!isDaemonRunning()) {
      if (options.json) {
        printJsonAndExit(result({ ok: false, error: "Daemon not running" }));
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
          printJsonAndExit(result({ ok: true, data: info }));
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

program
  .command("logs")
  .description("Show daemon logs")
  .option("--tail <n>", "Show last N lines")
  .option("--follow", "Follow log output")
  .action((options) => {
    options = { ...program.opts(), ...options };
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
