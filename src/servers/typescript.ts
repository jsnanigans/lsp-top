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
      // Give the server a moment to process
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return await time('typescript.definition', async () => this.client.getDefinition(uri, line - 1, character - 1));
  }
}
