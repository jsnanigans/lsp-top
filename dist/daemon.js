"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Daemon = void 0;
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const typescript_1 = require("./servers/typescript");
const logger_1 = require("./logger");
const config_1 = require("./config");
const path_utils_1 = require("./path-utils");
const SOCKET_PATH = "/tmp/lsp-top.sock";
function filterSymbols(symbols, query) {
    const result = [];
    for (const symbol of symbols) {
        // Check if symbol name matches query
        if (symbol.name && symbol.name.toLowerCase().includes(query)) {
            result.push(symbol);
        }
        // Recursively filter children if they exist
        if (symbol.children && Array.isArray(symbol.children)) {
            const filteredChildren = filterSymbols(symbol.children, query);
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
const PID_FILE = "/tmp/lsp-top.pid";
class Daemon {
    constructor() {
        this.lspInstances = new Map();
        this.config = new config_1.ConfigManager(); // reserved for future use
        this.server = net.createServer(this.handleConnection.bind(this));
    }
    start() {
        (0, logger_1.clearLogFile)();
        if (fs.existsSync(PID_FILE)) {
            try {
                const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
                if (!isNaN(pid)) {
                    try {
                        process.kill(pid, 0);
                        process.exit(0);
                    }
                    catch { }
                }
                fs.unlinkSync(PID_FILE);
            }
            catch { }
        }
        if (fs.existsSync(SOCKET_PATH)) {
            try {
                fs.unlinkSync(SOCKET_PATH);
            }
            catch { }
        }
        this.server.listen(SOCKET_PATH, () => {
            fs.writeFileSync(PID_FILE, String(process.pid));
            (0, logger_1.log)("info", "Daemon listening", { socket: SOCKET_PATH });
        });
        process.on("SIGINT", () => this.stop());
        process.on("SIGTERM", () => this.stop());
    }
    async stop() {
        (0, logger_1.log)("info", "Stopping daemon");
        for (const lsp of this.lspInstances.values()) {
            await lsp.stop();
        }
        this.lspInstances.clear();
        this.server.close(() => {
            try {
                if (fs.existsSync(SOCKET_PATH))
                    fs.unlinkSync(SOCKET_PATH);
            }
            catch { }
            try {
                if (fs.existsSync(PID_FILE))
                    fs.unlinkSync(PID_FILE);
            }
            catch { }
            (0, logger_1.log)("info", "Daemon stopped");
            process.exit(0);
        });
    }
    async handleConnection(socket) {
        let logListener = null;
        socket.on("data", async (data) => {
            try {
                const request = JSON.parse(data.toString());
                if (typeof request.logLevel === "string")
                    (0, logger_1.setLogLevel)(request.logLevel);
                if (typeof request.trace === "string" && request.trace)
                    (0, logger_1.setTraceFlags)(String(request.trace)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean));
                if (request.action === "stop") {
                    socket.write("OK\n");
                    socket.end();
                    await this.stop();
                    return;
                }
                if (request.action === "status") {
                    socket.write(JSON.stringify({ ok: true, sessions: this.lspInstances.size }) +
                        "\n");
                    socket.end();
                    return;
                }
                const lspRequest = request;
                if (lspRequest.verbose) {
                    logListener = (message) => {
                        socket.write(JSON.stringify({ type: "log", data: message }) + "\n");
                    };
                    logger_1.loggerEmitter.on("log", logListener);
                }
                if (lspRequest.action === "status") {
                    socket.write(JSON.stringify({ ok: true, sessions: this.lspInstances.size }) +
                        "\n");
                }
                else {
                    const result = await (0, logger_1.time)("daemon.handleRequest", () => this.handleRequest(lspRequest));
                    socket.write(JSON.stringify({ type: "result", data: result }) + "\n");
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                (0, logger_1.log)("error", "Error handling request", { message });
                socket.write(JSON.stringify({ type: "error", message }) + "\n");
            }
            finally {
                socket.end();
            }
        });
        socket.on("close", () => {
            if (logListener) {
                logger_1.loggerEmitter.removeListener("log", logListener);
            }
        });
        socket.on("error", (err) => {
            (0, logger_1.log)("warn", "Socket error", { error: String(err) });
        });
    }
    async handleRequest(request) {
        const { alias, action, args, projectPath } = request;
        let lsp = this.lspInstances.get(alias);
        if (!lsp) {
            (0, logger_1.log)("info", "Creating LSP instance", { alias, projectPath });
            lsp = new typescript_1.TypeScriptLSP(projectPath);
            await lsp.start();
            this.lspInstances.set(alias, lsp);
        }
        (0, logger_1.log)("debug", "Handling action", { action, alias });
        switch (action) {
            case "diagnostics": {
                if (!args[0]) {
                    throw new Error("File path required for diagnostics");
                }
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, args[0]);
                return await lsp.getDiagnostics(filePath);
            }
            case "definition": {
                if (!args[0]) {
                    throw new Error("File path and position required (e.g., file.ts:10:5)");
                }
                const [fileArg, lineStr, charStr] = args[0].split(":");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    throw new Error("Invalid position format. Use file.ts:line:column");
                }
                return await lsp.getDefinition(filePath, line, char);
            }
            case "references": {
                if (!args[0]) {
                    throw new Error("File path and position required (e.g., file.ts:10:5)");
                }
                const [fileArg, lineStr, charStr] = args[0].split(":");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    throw new Error("Invalid position format. Use file.ts:line:column");
                }
                const flags = JSON.parse(args[1] || "{}");
                return await lsp.getReferences(filePath, line, char, flags.includeDeclaration);
            }
            case "typeDefinition": {
                if (!args[0]) {
                    throw new Error("File path and position required (e.g., file.ts:10:5)");
                }
                const [fileArg, lineStr, charStr] = args[0].split(":");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    throw new Error("Invalid position format. Use file.ts:line:column");
                }
                return await lsp.getTypeDefinition(filePath, line, char);
            }
            case "implementation": {
                if (!args[0]) {
                    throw new Error("File path and position required (e.g., file.ts:10:5)");
                }
                const [fileArg, lineStr, charStr] = args[0].split(":");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    throw new Error("Invalid position format. Use file.ts:line:column");
                }
                return await lsp.getImplementation(filePath, line, char);
            }
            case "documentSymbols": {
                if (!args[0]) {
                    throw new Error("File path required");
                }
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, args[0]);
                const flags = JSON.parse(args[1] || "{}");
                const symbols = await lsp.getDocumentSymbols(filePath);
                // Filter symbols if query is provided
                if (flags.query) {
                    const query = String(flags.query).toLowerCase();
                    return filterSymbols(symbols, query);
                }
                return symbols;
            }
            case "workspaceSymbols": {
                const query = args[0] || "";
                return await lsp.getWorkspaceSymbols(query);
            }
            case "hover": {
                if (!args[0]) {
                    throw new Error("File path and position required (e.g., file.ts:10:5)");
                }
                const [fileArg, lineStr, charStr] = args[0].split(":");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    throw new Error("Invalid position format. Use file.ts:line:column");
                }
                return await lsp.getHover(filePath, line, char);
            }
            case "initialize": {
                // Force re-initialization of the workspace
                (0, logger_1.log)("info", "Initializing workspace", { projectPath });
                // Stop existing LSP if it exists
                if (this.lspInstances.has(alias)) {
                    const existing = this.lspInstances.get(alias);
                    await existing.stop();
                    this.lspInstances.delete(alias);
                }
                // Create new session with initialization
                const newLsp = new typescript_1.TypeScriptLSP(projectPath);
                await newLsp.start();
                this.lspInstances.set(alias, newLsp);
                // Trigger workspace indexing by opening tsconfig if it exists
                const tsconfigPath = require("path").join(projectPath, "tsconfig.json");
                if (fs.existsSync(tsconfigPath)) {
                    await newLsp.getDocumentSymbols(tsconfigPath);
                }
                return {
                    ok: true,
                    message: "Workspace initialized",
                    projectPath,
                };
            }
            case "refresh": {
                // Refresh the LSP session without full re-initialization
                (0, logger_1.log)("info", "Refreshing LSP session", { projectPath });
                if (!this.lspInstances.has(alias)) {
                    throw new Error(`No active session for project '${alias}'`);
                }
                // Trigger workspace re-indexing
                const lspSession = this.lspInstances.get(alias);
                // Find and open all TypeScript files to refresh the workspace
                const { glob } = await Promise.resolve().then(() => __importStar(require("glob")));
                const files = await glob("**/*.{ts,tsx}", {
                    cwd: projectPath,
                    ignore: ["node_modules/**", "dist/**", "build/**"],
                    absolute: true,
                });
                // Open first few files to trigger indexing
                for (const file of files.slice(0, 5)) {
                    await lspSession.getDocumentSymbols(file);
                }
                return {
                    ok: true,
                    message: `Refreshed workspace with ${files.length} TypeScript files`,
                    filesFound: files.length,
                };
            }
            case "inspect:file": {
                if (!args[0])
                    throw new Error("File path required");
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, args[0]);
                const flags = JSON.parse(args[1] || "{}");
                return await lsp.inspectFile(filePath, flags);
            }
            case "inspect:changed": {
                const flags = JSON.parse(args[0] || "{}");
                return await lsp.inspectChanged(flags);
            }
            case "edit:plan": {
                const raw = args[0] || "{}";
                return await lsp.planWorkspaceEdit(raw);
            }
            case "edit:apply": {
                const raw = args[0] || "{}";
                return await lsp.applyWorkspaceEditJson(raw);
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
}
exports.Daemon = Daemon;
if (process.argv[1].endsWith("daemon.js")) {
    const idxVerbose = process.argv.indexOf("--verbose");
    const idxLevel = process.argv.indexOf("--log-level");
    const idxTrace = process.argv.indexOf("--trace");
    if (idxLevel !== -1 && process.argv[idxLevel + 1])
        (0, logger_1.setLogLevel)(process.argv[idxLevel + 1]);
    else
        (0, logger_1.setLogLevel)(idxVerbose !== -1 ? "debug" : "info");
    if (idxTrace !== -1 && process.argv[idxTrace + 1])
        (0, logger_1.setTraceFlags)(process.argv[idxTrace + 1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean));
    const daemon = new Daemon();
    daemon.start();
}
