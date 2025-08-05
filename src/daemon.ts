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
  metrics,
  time,
} from "./logger";
import { ConfigManager } from "./config";
import { resolveProjectPath } from "./path-utils";

const SOCKET_PATH = "/tmp/lsp-top.sock";
const PID_FILE = "/tmp/lsp-top.pid";

interface LSPRequest {
  alias: string;
  action: string;
  args: string[];
  projectPath: string;
  verbose?: boolean;
  logLevel?: string;
  trace?: string;
}

class Daemon {
  private server: net.Server;
  private lspInstances: Map<string, TypeScriptLSP> = new Map();
  private config = new ConfigManager(); // reserved for future use

  constructor() {
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  start() {
    clearLogFile();
    if (fs.existsSync(PID_FILE)) {
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
        if (!isNaN(pid)) {
          try {
            process.kill(pid, 0);
            process.exit(0);
          } catch {}
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
      log("info", "Daemon listening", { socket: SOCKET_PATH });
    });

    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  async stop() {
    log("info", "Stopping daemon");
    for (const lsp of this.lspInstances.values()) {
      await lsp.stop();
    }
    this.lspInstances.clear();

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

  private async handleConnection(socket: net.Socket) {
    let logListener: ((message: string) => void) | null = null;

    socket.on("data", async (data) => {
      try {
        const request = JSON.parse(data.toString());

        if (typeof request.logLevel === "string")
          setLogLevel(request.logLevel as Level);
        if (typeof request.trace === "string" && request.trace)
          setTraceFlags(
            String(request.trace)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );

        if (request.action === "stop") {
          socket.write("OK\n");
          socket.end();
          await this.stop();
          return;
        }
        if (request.action === "status") {
          socket.write(
            JSON.stringify({ ok: true, sessions: this.lspInstances.size }) +
              "\n",
          );
          socket.end();
          return;
        }
        const lspRequest = request as LSPRequest;
        if (lspRequest.verbose) {
          logListener = (message: string) => {
            socket.write(JSON.stringify({ type: "log", data: message }) + "\n");
          };
          loggerEmitter.on("log", logListener);
        }

        if (lspRequest.action === "status") {
          socket.write(
            JSON.stringify({ ok: true, sessions: this.lspInstances.size }) +
              "\n",
          );
        } else {
          const result = await time("daemon.handleRequest", () =>
            this.handleRequest(lspRequest),
          );
          socket.write(JSON.stringify({ type: "result", data: result }) + "\n");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", "Error handling request", { message });
        socket.write(JSON.stringify({ type: "error", message }) + "\n");
      } finally {
        socket.end();
      }
    });

    socket.on("close", () => {
      if (logListener) {
        loggerEmitter.removeListener("log", logListener);
      }
    });

    socket.on("error", (err) => {
      log("warn", "Socket error", { error: String(err) });
    });
  }

  private async handleRequest(request: LSPRequest) {
    const { alias, action, args, projectPath } = request;
    let lsp = this.lspInstances.get(alias);

    if (!lsp) {
      log("info", "Creating LSP instance", { alias, projectPath });
      lsp = new TypeScriptLSP(projectPath);
      await lsp.start();
      this.lspInstances.set(alias, lsp);
    }

    log("debug", "Handling action", { action, alias });
    switch (action) {
      case "diagnostics": {
        if (!args[0]) {
          throw new Error("File path required for diagnostics");
        }
        const filePath = resolveProjectPath(projectPath, args[0]);
        return await lsp.getDiagnostics(filePath);
      }
      case "definition": {
        if (!args[0]) {
          throw new Error(
            "File path and position required (e.g., file.ts:10:5)",
          );
        }
        const [fileArg, lineStr, charStr] = args[0].split(":");
        const filePath = resolveProjectPath(projectPath, fileArg);
        const line = parseInt(lineStr, 10);
        const char = parseInt(charStr, 10);

        if (isNaN(line) || isNaN(char)) {
          throw new Error("Invalid position format. Use file.ts:line:column");
        }
        return await lsp.getDefinition(filePath, line, char);
      }
      case "inspect:file": {
        if (!args[0]) throw new Error("File path required");
        const filePath = resolveProjectPath(projectPath, args[0]);
        const flags = JSON.parse(args[1] || "{}");
        return await lsp.inspectFile(filePath, flags);
      }
      case "inspect:changed": {
        const flags = JSON.parse(args[0] || "{}");
        return await lsp.inspectChanged(flags);
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

if (process.argv[1].endsWith("daemon.js")) {
  const idxVerbose = process.argv.indexOf("--verbose");
  const idxLevel = process.argv.indexOf("--log-level");
  const idxTrace = process.argv.indexOf("--trace");
  if (idxLevel !== -1 && process.argv[idxLevel + 1])
    setLogLevel(process.argv[idxLevel + 1] as Level);
  else setLogLevel(idxVerbose !== -1 ? "debug" : "info");
  if (idxTrace !== -1 && process.argv[idxTrace + 1])
    setTraceFlags(
      process.argv[idxTrace + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  const daemon = new Daemon();
  daemon.start();
}

export { Daemon };
