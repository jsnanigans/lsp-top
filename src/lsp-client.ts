import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

export interface LSPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class LSPClient {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private responseHandlers = new Map<number | string, (response: LSPMessage) => void>();
  
  constructor(
    private command: string,
    private args: string[],
    private workspaceRoot: string
  ) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // console.log(`Starting LSP: ${this.command} ${this.args.join(' ')}`);
      // console.log(`Working directory: ${this.workspaceRoot}`);
      
      this.process = spawn(this.command, this.args, {
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
            if (headerEnd === -1) break;

            const headerSection = buffer.substring(0, headerEnd);
            buffer = buffer.substring(headerEnd + 4);

            const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/);
            if (contentLengthMatch) {
              contentLength = parseInt(contentLengthMatch[1], 10);
              isReadingHeaders = false;
            }
          } else {
            if (buffer.length >= contentLength) {
              const messageContent = buffer.substring(0, contentLength);
              buffer = buffer.substring(contentLength);

              try {
                const message = JSON.parse(messageContent);
                this.handleMessage(message);
              } catch (e) {
                console.error('Failed to parse LSP message:', e, 'Content:', messageContent);
              }

              contentLength = 0;
              isReadingHeaders = true;
            } else {
              break;
            }
          }
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('LSP stderr:', data.toString());
      });

      this.process.on('error', (error) => {
        console.error('LSP process error:', error);
        reject(error);
      });
      
      this.process.on('exit', (code) => {
        console.error(`LSP server exited with code ${code}`);
      });

      setTimeout(() => {
        // console.log('LSP server started');
        resolve();
      }, 100);
    });
  }

  private diagnostics: Map<string, any[]> = new Map();
  
  private handleMessage(message: LSPMessage): void {
    if (message.id !== undefined && this.responseHandlers.has(message.id)) {
      const handler = this.responseHandlers.get(message.id)!;
      this.responseHandlers.delete(message.id);
      handler(message);
    } else if (message.method) {
      if (message.method === 'textDocument/publishDiagnostics') {
        const uri = message.params?.uri;
        const diagnostics = message.params?.diagnostics || [];
        if (uri) {
          this.diagnostics.set(uri, diagnostics);
        }
      } else if (message.method !== 'window/logMessage') {
        console.log('Notification:', message.method);
      }
    }
  }

  getDiagnosticsForUri(uri: string): any[] {
    return this.diagnostics.get(uri) || [];
  }

  sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.sendMessage(message);
    });
  }

  sendMessage(message: LSPMessage): void {
    if (!this.process?.stdin) {
      throw new Error('LSP process not started');
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.process.stdin.write(header + content);
  }

  async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.workspaceRoot}`,
      capabilities: {
        textDocument: {
          synchronization: {
            openClose: true,
            change: 1
          }
        }
      }
    });

    this.sendMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      await this.sendRequest('shutdown');
      this.sendMessage({ jsonrpc: '2.0', method: 'exit' });
      this.process.kill();
      this.process = null;
    }
  }

  async getDiagnostics(uri: string): Promise<any> {
    return this.sendRequest('textDocument/diagnostic', {
      textDocument: { uri }
    });
  }

  async getDefinition(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character }
    });
  }
}