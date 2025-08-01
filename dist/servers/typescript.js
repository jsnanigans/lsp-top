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
exports.TypeScriptLSP = void 0;
const lsp_client_1 = require("../lsp-client");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../logger");
class TypeScriptLSP {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.openDocuments = new Set();
        const vtsls = this.findVtsls();
        (0, logger_1.log)(`Using vtsls at: ${vtsls}`);
        this.client = new lsp_client_1.LSPClient(vtsls, ['--stdio'], workspaceRoot);
    }
    findVtsls() {
        const possiblePaths = [
            path.join(this.workspaceRoot, 'node_modules/.bin/vtsls'),
            path.join(process.cwd(), 'node_modules/.bin/vtsls'),
            'vtsls' // Try global/PATH installation
        ];
        for (const vtsPath of possiblePaths) {
            (0, logger_1.log)(`Checking for vtsls at: ${vtsPath}`);
            if (vtsPath === 'vtsls' || fs.existsSync(vtsPath)) {
                return vtsPath;
            }
        }
        throw new Error('vtsls language server not found. Make sure @vtsls/language-server is installed.');
    }
    async start() {
        await this.client.start();
        await this.client.initialize();
    }
    async stop() {
        await this.client.shutdown();
    }
    async getDiagnostics(filePath) {
        const uri = `file://${filePath}`;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (this.openDocuments.has(uri)) {
            // Document is already open, send a change notification to trigger re-analysis
            (0, logger_1.log)(`Document ${uri} is already open, sending change notification.`);
            this.client.sendMessage({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri,
                        version: Date.now() // Use timestamp as version
                    },
                    contentChanges: [{
                            text: content
                        }]
                }
            });
        }
        else {
            // First time opening this document
            (0, logger_1.log)(`Opening document ${uri}...`);
            this.client.sendMessage({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                    textDocument: {
                        uri,
                        languageId: 'typescript',
                        version: 1,
                        text: content
                    }
                }
            });
            this.openDocuments.add(uri);
        }
        // Give the server more time to process and push diagnostics
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Return the diagnostics from the client's cache
        return this.client.getDiagnostics(uri);
    }
    async getDefinition(filePath, line, character) {
        const uri = `file://${filePath}`;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!this.openDocuments.has(uri)) {
            this.client.sendMessage({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                    textDocument: {
                        uri,
                        languageId: 'typescript',
                        version: 1,
                        text: content
                    }
                }
            });
            this.openDocuments.add(uri);
            // Give the server a moment to process
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return this.client.getDefinition(uri, line - 1, character - 1);
    }
}
exports.TypeScriptLSP = TypeScriptLSP;
