import { LSPClient } from '../lsp-client';
import * as path from 'path';
import * as fs from 'fs';
import { log } from '../logger';

export class TypeScriptLSP {
  private client: LSPClient;

  constructor(private workspaceRoot: string) {
    const vtsls = this.findVtsls();
    log(`Using vtsls at: ${vtsls}`);
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
      log(`Checking for vtsls at: ${vtsPath}`);
      if (vtsPath === 'vtsls' || fs.existsSync(vtsPath)) {
        return vtsPath;
      }
    }

    throw new Error('vtsls language server not found. Make sure @vtsls/language-server is installed.');
  }

  async start(): Promise<void> {
    await this.client.start();
    await this.client.initialize();
  }

  async stop(): Promise<void> {
    await this.client.shutdown();
  }

  async getDiagnostics(filePath: string): Promise<any> {
    const uri = `file://${filePath}`;
    
    // First, we need to open the document (this is a notification, not a request)
    const content = fs.readFileSync(filePath, 'utf-8');
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
    
    // Send a didChangeConfiguration to ensure TypeScript is fully initialized
    this.client.sendMessage({
      jsonrpc: '2.0',
      method: 'workspace/didChangeConfiguration',
      params: {
        settings: {}
      }
    });
    
    // Wait longer for TypeScript to fully analyze the file
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to get diagnostics using the pull-based method first
    const result = await this.client.getDiagnostics(uri);
    return result;
  }

  async getDefinition(filePath: string, line: number, character: number): Promise<any> {
    const uri = `file://${filePath}`;
    
    // First, we need to open the document
    const content = fs.readFileSync(filePath, 'utf-8');
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
    
    // Send a didChangeConfiguration to ensure TypeScript is initialized
    this.client.sendMessage({
      jsonrpc: '2.0',
      method: 'workspace/didChangeConfiguration',
      params: {
        settings: {}
      }
    });
    
    // Wait a bit for the document to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.client.getDefinition(uri, line - 1, character - 1);
  }
}