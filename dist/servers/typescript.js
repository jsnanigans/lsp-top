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
        (0, logger_1.log)('info', 'Using vtsls', { path: vtsls });
        this.client = new lsp_client_1.LSPClient(vtsls, ['--stdio'], workspaceRoot);
    }
    findVtsls() {
        const possiblePaths = [
            path.join(this.workspaceRoot, 'node_modules/.bin/vtsls'),
            path.join(process.cwd(), 'node_modules/.bin/vtsls'),
            'vtsls' // Try global/PATH installation
        ];
        for (const vtsPath of possiblePaths) {
            (0, logger_1.log)('debug', 'Checking for vtsls', { path: vtsPath });
            if (vtsPath === 'vtsls' || fs.existsSync(vtsPath)) {
                return vtsPath;
            }
        }
        throw new Error('vtsls language server not found. Make sure @vtsls/language-server is installed.');
    }
    async start() {
        await (0, logger_1.time)('typescript.start', async () => {
            await this.client.start();
            await this.client.initialize();
        });
    }
    async stop() {
        await this.client.shutdown();
    }
    async getDiagnostics(filePath) {
        const uri = `file://${filePath}`;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (this.openDocuments.has(uri)) {
            // Document is already open, send a change notification to trigger re-analysis
            (0, logger_1.log)('trace', 'Document change', { uri });
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
            (0, logger_1.log)('trace', 'Opening document', { uri });
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await (0, logger_1.time)('typescript.diagnostics', async () => this.client.getDiagnostics(uri));
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
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return await (0, logger_1.time)('typescript.definition', async () => this.client.getDefinition(uri, line - 1, character - 1));
    }
    async codeActions(uri, diagnostics) {
        const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
        try {
            const actions = await this.client.sendRequest('textDocument/codeAction', {
                textDocument: { uri },
                range,
                context: { diagnostics }
            });
            return Array.isArray(actions) ? actions : [];
        }
        catch {
            return [];
        }
    }
    async format(uri) {
        try {
            const edits = await this.client.sendRequest('textDocument/formatting', {
                textDocument: { uri },
                options: { tabSize: 2, insertSpaces: true }
            });
            return Array.isArray(edits) ? edits : [];
        }
        catch {
            return [];
        }
    }
    async organizeImports(uri) {
        const action = await this.client.sendRequest('workspace/executeCommand', {
            command: '_typescript.organizeImports',
            arguments: [{ scope: { type: 'file', args: { uri } } }]
        });
        return Array.isArray(action) ? action : [];
    }
    async inspectFile(filePath, flags = {}) {
        const uri = `file://${filePath}`;
        await this.getDiagnostics(filePath);
        const diagnostics = this.client.getDiagnosticsForUri(uri);
        const edits = { changes: {} };
        if (flags.organizeImports) {
            const oi = await this.organizeImports(uri);
            if (oi.length)
                edits.changes[uri] = (edits.changes[uri] || []).concat(oi);
        }
        if (flags.format) {
            const fmt = await this.format(uri);
            if (fmt.length)
                edits.changes[uri] = (edits.changes[uri] || []).concat(fmt);
        }
        if (flags.fix || flags.fixDry) {
            const actions = await this.codeActions(uri, diagnostics);
            for (const a of actions) {
                if (a.edit) {
                    if (a.edit.documentChanges) {
                        edits.documentChanges = (edits.documentChanges || []).concat(a.edit.documentChanges);
                    }
                    if (a.edit.changes) {
                        for (const k of Object.keys(a.edit.changes)) {
                            edits.changes[k] = (edits.changes[k] || []).concat(a.edit.changes[k]);
                        }
                    }
                }
            }
        }
        if (flags.write) {
            await this.applyWorkspaceEdit(edits);
            await new Promise((r) => setTimeout(r, 200));
        }
        const res = { diagnostics, edits };
        return res;
    }
    async applyWorkspaceEdit(edit) {
        if (edit.documentChanges && Array.isArray(edit.documentChanges)) {
            for (const dc of edit.documentChanges) {
                if (dc.textDocument && dc.edits) {
                    await this.applyEditsToUri(dc.textDocument.uri, dc.edits);
                }
            }
        }
        if (edit.changes) {
            for (const [uri, edits] of Object.entries(edit.changes)) {
                await this.applyEditsToUri(uri, edits);
            }
        }
    }
    async applyEditsToUri(uri, edits) {
        const filePath = uri.replace(/^file:\/\//, '');
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const sorted = [...edits].sort((a, b) => {
            const sa = a.range.start;
            const sb = b.range.start;
            if (sa.line !== sb.line)
                return sb.line - sa.line;
            return sb.character - sa.character;
        });
        let text = content;
        for (const e of sorted) {
            const start = this.offsetOf(lines, e.range.start.line, e.range.start.character);
            const end = this.offsetOf(lines, e.range.end.line, e.range.end.character);
            text = text.slice(0, start) + (e.newText || '') + text.slice(end);
        }
        fs.writeFileSync(filePath, text, 'utf-8');
        if (this.openDocuments.has(uri)) {
            this.client.sendMessage({ jsonrpc: '2.0', method: 'textDocument/didChange', params: { textDocument: { uri, version: Date.now() }, contentChanges: [{ text }] } });
        }
    }
    offsetOf(lines, line, ch) {
        let off = 0;
        for (let i = 0; i < line; i++)
            off += lines[i].length + 1;
        return off + ch;
    }
    async inspectChanged(flags = {}) {
        const { gitChangedFiles } = await Promise.resolve().then(() => __importStar(require('../path-utils')));
        const files = await gitChangedFiles(this.workspaceRoot, { staged: !!flags.staged });
        const out = {};
        for (const f of files.filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) {
            out[f] = await this.inspectFile(f, flags);
        }
        return out;
    }
}
exports.TypeScriptLSP = TypeScriptLSP;
