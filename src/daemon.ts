
import * as net from 'net';
import * as fs from 'fs';
import { TypeScriptLSP } from './servers/typescript';
import { log, setVerbose, loggerEmitter, clearLogFile } from './logger';
import { ConfigManager } from './config';
import { resolveProjectPath } from './path-utils';

const SOCKET_PATH = '/tmp/lsp-top.sock';

interface LSPRequest {
  alias: string;
  action: string;
  args: string[];
  projectPath: string;
  verbose?: boolean;
}

class Daemon {
  private server: net.Server;
  private lspInstances: Map<string, TypeScriptLSP> = new Map();
  private config = new ConfigManager();

  constructor() {
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  start() {
    clearLogFile();
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }

    this.server.listen(SOCKET_PATH, () => {
      log(`Daemon listening on ${SOCKET_PATH}`);
    });

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  async stop() {
    log('Stopping daemon...');
    for (const lsp of this.lspInstances.values()) {
      await lsp.stop();
    }
    this.lspInstances.clear();

    this.server.close(() => {
      if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
      }
      log('Daemon stopped.');
      process.exit(0);
    });
  }

  private async handleConnection(socket: net.Socket) {
    let logListener: ((message: string) => void) | null = null;

    socket.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString());

        // Handle stop command
        if (request.action === 'stop') {
          socket.write('OK\n');
          socket.end();
          await this.stop();
          return;
        }
        if (request.action === 'status') {
          socket.write(JSON.stringify({ ok: true, sessions: this.lspInstances.size }) + '\n');
          socket.end();
          return;
        }
        // Handle normal LSP requests
        const lspRequest = request as LSPRequest;
        if (lspRequest.verbose) {
            logListener = (message: string) => {
                socket.write(JSON.stringify({ type: 'log', data: message }) + '\n');
            };
            loggerEmitter.on('log', logListener);
        }

        if (lspRequest.action === 'status') {
          socket.write(JSON.stringify({ ok: true, sessions: this.lspInstances.size }) + '\n');
        } else {
          const result = await this.handleRequest(lspRequest);
          socket.write(JSON.stringify({ type: 'result', data: result }) + '\n');
        }      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Error handling request: ${message}`);
        socket.write(JSON.stringify({ type: 'error', message }) + '\n');
      } finally {
        socket.end();
      }
    });

    socket.on('close', () => {
      if (logListener) {
        loggerEmitter.removeListener('log', logListener);
      }
    });

    socket.on('error', (err) => {
      log('Socket error:', err);
    });
  }

  private async handleRequest(request: LSPRequest) {
    const { alias, action, args, projectPath } = request;
    let lsp = this.lspInstances.get(alias);

    if (!lsp) {
      log(`Creating new LSP instance for alias '${alias}' at ${projectPath}`);
      lsp = new TypeScriptLSP(projectPath);
      await lsp.start();
      this.lspInstances.set(alias, lsp);
    }

    log(`Handling action '${action}' for alias '${alias}'`);

    switch (action) {
      case 'diagnostics': {
        if (!args[0]) {
          throw new Error('File path required for diagnostics');
        }
        const filePath = resolveProjectPath(projectPath, args[0]);
        return await lsp.getDiagnostics(filePath);
      }
      case 'definition': {
        if (!args[0]) {
          throw new Error('File path and position required (e.g., file.ts:10:5)');
        }
        const [fileArg, lineStr, charStr] = args[0].split(':');
        const filePath = resolveProjectPath(projectPath, fileArg);
        const line = parseInt(lineStr, 10);
        const char = parseInt(charStr, 10);

        if (isNaN(line) || isNaN(char)) {
          throw new Error('Invalid position format. Use file.ts:line:column');
        }
        return await lsp.getDefinition(filePath, line, char);
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

// This allows the daemon to be started directly
if (process.argv[1].endsWith('daemon.js')) {
    setVerbose(process.argv.includes('--verbose'));
    const daemon = new Daemon();
    daemon.start();
  }

export { Daemon };
