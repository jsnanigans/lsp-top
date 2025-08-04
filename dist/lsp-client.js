"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LSPClient = void 0;
const child_process_1 = require("child_process");
const logger_1 = require("./logger");
class LSPClient {
    constructor(command, args, workspaceRoot) {
        this.command = command;
        this.args = args;
        this.workspaceRoot = workspaceRoot;
        this.process = null;
        this.messageId = 0;
        this.responseHandlers = new Map();
        this.diagnostics = new Map();
    }
    async start() {
        return new Promise((resolve, reject) => {
            (0, logger_1.log)('info', 'Starting LSP', { cmd: this.command, args: this.args, cwd: this.workspaceRoot });
            (0, logger_1.log)('debug', 'Working directory', { cwd: this.workspaceRoot });
            this.process = (0, child_process_1.spawn)(this.command, this.args, {
                cwd: this.workspaceRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
                shell: true
            });
            if (!this.process.stdout || !this.process.stdin) {
                reject(new Error('Failed to create process streams'));
                return;
            }
            let buffer = '';
            let contentLength = 0;
            let isReadingHeaders = true;
            this.process.stdout.on('data', (data) => {
                buffer += data.toString();
                while (buffer.length > 0) {
                    if (isReadingHeaders) {
                        const headerEnd = buffer.indexOf('\r\n\r\n');
                        if (headerEnd === -1)
                            break;
                        const headerSection = buffer.substring(0, headerEnd);
                        buffer = buffer.substring(headerEnd + 4);
                        const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/);
                        if (contentLengthMatch) {
                            contentLength = parseInt(contentLengthMatch[1], 10);
                            isReadingHeaders = false;
                        }
                    }
                    else {
                        if (buffer.length >= contentLength) {
                            const messageContent = buffer.substring(0, contentLength);
                            buffer = buffer.substring(contentLength);
                            try {
                                const message = JSON.parse(messageContent);
                                this.handleMessage(message);
                            }
                            catch (e) {
                                console.error('Failed to parse LSP message:', e, 'Content:', messageContent);
                            }
                            contentLength = 0;
                            isReadingHeaders = true;
                        }
                        else {
                            break;
                        }
                    }
                }
            });
            this.process.stderr?.on('data', (data) => {
                (0, logger_1.log)('warn', 'LSP stderr', { data: String(data) });
            });
            this.process.on('error', (error) => {
                (0, logger_1.log)('error', 'LSP process error', { error: String(error) });
                reject(error);
            });
            this.process.on('exit', (code) => {
                // Only log if unexpected exit
                if (code !== 0 && code !== null) {
                    (0, logger_1.log)('warn', 'LSP server exited', { code });
                }
            });
            setTimeout(() => {
                (0, logger_1.log)('info', 'LSP server started');
                resolve();
            }, 100);
        });
    }
    handleMessage(message) {
        (0, logger_1.log)('trace', 'LSP received', { preview: JSON.stringify(message).slice(0, 200) + '...' });
        if (message.id !== undefined && this.responseHandlers.has(message.id)) {
            const handler = this.responseHandlers.get(message.id);
            this.responseHandlers.delete(message.id);
            handler(message);
        }
        else if (message.method) {
            if (message.method === 'textDocument/publishDiagnostics') {
                const uri = message.params?.uri;
                const diagnostics = message.params?.diagnostics || [];
                (0, logger_1.log)('debug', 'Diagnostics received', { uri, count: diagnostics.length });
                if (uri) {
                    this.diagnostics.set(uri, diagnostics);
                }
            }
            else if (message.method === 'workspace/configuration') {
                // Handle workspace configuration request from server
                (0, logger_1.log)('debug', 'Server requesting workspace configuration');
                const response = {
                    jsonrpc: '2.0',
                    id: message.id,
                    result: message.params?.items?.map(() => ({})) || [{}]
                };
                this.sendMessage(response);
            }
            else if (message.method !== 'window/logMessage') {
                (0, logger_1.log)('debug', 'Unhandled notification', { method: message.method });
            }
        }
    }
    getDiagnosticsForUri(uri) {
        return this.diagnostics.get(uri) || [];
    }
    sendRequest(method, params) {
        const id = ++this.messageId;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.responseHandlers.delete(id);
                reject(new Error(`Request ${method} timed out after 10 seconds`));
            }, 10000);
            this.responseHandlers.set(id, (response) => {
                clearTimeout(timeout);
                if (response.error) {
                    reject(new Error(response.error.message));
                }
                else {
                    resolve(response.result);
                }
            });
            this.sendMessage(message);
        });
    }
    sendMessage(message) {
        if (!this.process?.stdin) {
            throw new Error('LSP process not started');
        }
        (0, logger_1.log)('trace', 'LSP sending', { message });
        const content = JSON.stringify(message);
        const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
        this.process.stdin.write(header + content);
    }
    async initialize() {
        await this.sendRequest('initialize', {
            processId: process.pid,
            rootUri: `file://${this.workspaceRoot}`,
            rootPath: this.workspaceRoot,
            workspaceFolders: [{
                    uri: `file://${this.workspaceRoot}`,
                    name: 'workspace'
                }],
            capabilities: {
                workspace: {
                    workspaceFolders: true,
                    configuration: true
                },
                textDocument: {
                    synchronization: {
                        openClose: true,
                        change: 1
                    },
                    publishDiagnostics: {
                        relatedInformation: true,
                        versionSupport: false,
                        tagSupport: {
                            valueSet: [1, 2]
                        }
                    },
                    diagnostic: {
                        dynamicRegistration: false,
                        relatedDocumentSupport: false
                    }
                }
            },
            initializationOptions: {
                preferences: {
                    includeInlayParameterNameHints: "all",
                    includeInlayParameterNameHintsWhenArgumentMatchesName: true,
                    includeInlayFunctionParameterTypeHints: true,
                    includeInlayVariableTypeHints: true,
                    includeInlayPropertyDeclarationTypeHints: true,
                    includeInlayFunctionLikeReturnTypeHints: true,
                    includeInlayEnumMemberValueHints: true
                }
            }
        });
        this.sendMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
    }
    async shutdown() {
        if (this.process) {
            try {
                await this.sendRequest('shutdown');
                this.sendMessage({ jsonrpc: '2.0', method: 'exit' });
                // Give the process a moment to exit gracefully
                await new Promise(resolve => setTimeout(resolve, 100));
                if (this.process && !this.process.killed) {
                    this.process.kill();
                }
                this.process = null;
            }
            catch (error) {
                // Force kill if shutdown fails
                if (this.process && !this.process.killed) {
                    this.process.kill();
                }
                this.process = null;
            }
        }
    }
    async getDiagnostics(uri) {
        // First try the pull-based diagnostic request
        try {
            const result = await this.sendRequest('textDocument/diagnostic', {
                textDocument: { uri }
            });
            return result;
        }
        catch (error) {
            (0, logger_1.log)('info', 'Pull-based diagnostics failed, falling back to push-based');
            // Fall back to push-based diagnostics
            return { diagnostics: this.getDiagnosticsForUri(uri) };
        }
    }
    async getDefinition(uri, line, character) {
        return this.sendRequest('textDocument/definition', {
            textDocument: { uri },
            position: { line, character }
        });
    }
}
exports.LSPClient = LSPClient;
