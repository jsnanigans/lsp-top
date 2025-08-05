import { LSPClient } from '../lsp-client';
import * as path from 'path';
import * as fs from 'fs';
import { log, time, metrics } from '../logger';

export class TypeScriptLSP {
  private client: LSPClient;
  private openDocuments = new Set<string>();

  constructor(private workspaceRoot: string) {
    const vtsls = this.findVtsls();
    log('info', 'Using vtsls', { path: vtsls });
    this.client = new LSPClient(
      vtsls,
      ['--stdio'],
      workspaceRoot
    );
  }

  private findVtsls(): string {
    const possiblePaths = [
      path.join(this.workspaceRoot, 'node_modules/.bin/vtsls'),
      path.join(process.cwd(), 'node_modules/.bin/vtsls'),
      'vtsls' // Try global/PATH installation
    ];

    for (const vtsPath of possiblePaths) {
      log('debug', 'Checking for vtsls', { path: vtsPath });
      if (vtsPath === 'vtsls' || fs.existsSync(vtsPath)) {
        return vtsPath;
      }
    }

    throw new Error('vtsls language server not found. Make sure @vtsls/language-server is installed.');
  }

  async start(): Promise<void> {
    await time('typescript.start', async () => {
      await this.client.start();
      await this.client.initialize();
    });
  }

  async stop(): Promise<void> {
    await this.client.shutdown();
  }

  async getDiagnostics(filePath: string): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (this.openDocuments.has(uri)) {
      // Document is already open, send a change notification to trigger re-analysis
      log('trace', 'Document change', { uri });
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
    } else {
      // First time opening this document
      log('trace', 'Opening document', { uri });
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
    return await time('typescript.diagnostics', async () => this.client.getDiagnostics(uri));
  }

  async getDefinition(filePath: string, line: number, character: number): Promise<any> {
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

    return await time('typescript.definition', async () => this.client.getDefinition(uri, line - 1, character - 1));
  }

  private async codeActions(uri: string, diagnostics: any[]): Promise<any[]> {
    const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    try {
      const actions = await this.client.sendRequest('textDocument/codeAction', {
        textDocument: { uri },
        range,
        context: { diagnostics }
      });
      return Array.isArray(actions) ? actions : [];
    } catch {
      return [];
    }
  }

  private async format(uri: string): Promise<any[]> {
    try {
      const edits = await this.client.sendRequest('textDocument/formatting', {
        textDocument: { uri },
        options: { tabSize: 2, insertSpaces: true }
      });
      return Array.isArray(edits) ? edits : [];
    } catch {
      return [];
    }
  }

  private async organizeImports(uri: string): Promise<any[]> {
    const action = await this.client.sendRequest('workspace/executeCommand', {
      command: '_typescript.organizeImports',
      arguments: [{ scope: { type: 'file', args: { uri } } }]
    });
    return Array.isArray(action) ? action : [];
  }

  async inspectFile(filePath: string, flags: { fix?: boolean; fixDry?: boolean; organizeImports?: boolean; format?: boolean; write?: boolean } = {}) {
    const uri = `file://${filePath}`;
    await this.getDiagnostics(filePath);
    const diagnostics = this.client.getDiagnosticsForUri(uri);
    const edits: { documentChanges?: any[]; changes?: Record<string, any[]> } = { changes: {} };

    if (flags.organizeImports) {
      const oi = await this.organizeImports(uri);
      if (oi.length) edits.changes![uri] = (edits.changes![uri] || []).concat(oi);
    }
    if (flags.format) {
      const fmt = await this.format(uri);
      if (fmt.length) edits.changes![uri] = (edits.changes![uri] || []).concat(fmt);
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
              edits.changes![k] = (edits.changes![k] || []).concat(a.edit.changes[k]);
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

  private async applyWorkspaceEdit(edit: { documentChanges?: any[]; changes?: Record<string, any[]> }) {
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

  private async applyEditsToUri(uri: string, edits: any[]) {
    const filePath = uri.replace(/^file:\/\//, '');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const sorted = [...edits].sort((a, b) => {
      const sa = a.range.start; const sb = b.range.start;
      if (sa.line !== sb.line) return sb.line - sa.line;
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

  private offsetOf(lines: string[], line: number, ch: number) {
    let off = 0;
    for (let i = 0; i < line; i++) off += lines[i].length + 1;
    return off + ch;
  }

  async inspectChanged(flags: { staged?: boolean; organizeImports?: boolean; format?: boolean; fix?: boolean; fixDry?: boolean; write?: boolean } = {}) {
    const { gitChangedFiles } = await import('../path-utils');
    const files = await gitChangedFiles(this.workspaceRoot, { staged: !!flags.staged });
    const out: Record<string, any> = {};
    for (const f of files.filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) {
      out[f] = await this.inspectFile(f, flags as any);
    }
    return out;
  }
}
