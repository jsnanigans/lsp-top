import { spawn, ChildProcess } from "child_process";
import { log } from "./logger";

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
  private responseHandlers = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void }
  >();
  private buffer = "";
  private isHealthy: boolean = false;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;

  constructor(
    private command: string,
    private args: string[],
    private workspaceRoot: string,
  ) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      log("info", "Starting LSP", {
        cmd: this.command,
        args: this.args,
        cwd: this.workspaceRoot,
      });
      log("debug", "Working directory", { cwd: this.workspaceRoot });

      this.process = spawn(this.command, this.args, {
        cwd: this.workspaceRoot,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
        shell: true,
      });

      if (!this.process.stdout || !this.process.stdin) {
        reject(new Error("Failed to create process streams"));
        return;
      }

      let buffer = "";
      let contentLength = 0;
      let isReadingHeaders = true;

      this.process.stdout.on("data", (data) => {
        buffer += data.toString();

        while (buffer.length > 0) {
          if (isReadingHeaders) {
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;

            const headerSection = buffer.substring(0, headerEnd);
            buffer = buffer.substring(headerEnd + 4);

            const contentLengthMatch = headerSection.match(
              /Content-Length:\s*(\d+)/,
            );
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
                console.error(
                  "Failed to parse LSP message:",
                  e,
                  "Content:",
                  messageContent,
                );
              }

              contentLength = 0;
              isReadingHeaders = true;
            } else {
              break;
            }
          }
        }
      });

      this.process.stderr?.on("data", (data) => {
        log("warn", "LSP stderr", { data: String(data) });
      });

      this.process.on("error", (error) => {
        log("error", "LSP process error", { error: String(error) });
        reject(error);
      });

      this.process.on("exit", async (code) => {
        this.isHealthy = false;
        // Only log if unexpected exit
        if (code !== 0 && code !== null) {
          log("error", "LSP server crashed", { code });

          // Notify all pending requests of the crash
          for (const [id, handler] of this.responseHandlers) {
            handler.reject(new Error(`LSP server crashed with code ${code}`));
          }
          this.responseHandlers.clear();
        }
      });

      setTimeout(() => {
        log("info", "LSP server started");
        this.isHealthy = true;
        resolve();
      }, 100);
    });
  }

  private diagnostics: Map<string, any[]> = new Map();

  private handleMessage(message: LSPMessage): void {
    log("trace", "LSP received", {
      preview: JSON.stringify(message).slice(0, 200) + "...",
    });
    if (
      message.id !== undefined &&
      typeof message.id === "number" &&
      this.responseHandlers.has(message.id)
    ) {
      const handler = this.responseHandlers.get(message.id)!;
      this.responseHandlers.delete(message.id);
      if (message.error) {
        handler.reject(new Error(message.error.message || "Unknown error"));
      } else {
        handler.resolve(message.result);
      }
    } else if (message.method) {
      if (message.method === "textDocument/publishDiagnostics") {
        const uri = message.params?.uri;
        const diagnostics = message.params?.diagnostics || [];
        log("debug", "Diagnostics received", {
          uri,
          count: diagnostics.length,
        });
        if (uri) {
          this.diagnostics.set(uri, diagnostics);
        }
      } else if (message.method === "workspace/configuration") {
        // Handle workspace configuration request from server
        log("debug", "Server requesting workspace configuration");
        const response: LSPMessage = {
          jsonrpc: "2.0",
          id: message.id,
          result: message.params?.items?.map(() => ({})) || [{}],
        };
        this.sendMessage(response);
      } else if (message.method !== "window/logMessage") {
        log("debug", "Unhandled notification", { method: message.method });
      }
    }
  }

  getDiagnosticsForUri(uri: string): any[] {
    return this.diagnostics.get(uri) || [];
  }

  sendNotification(method: string, params?: any): void {
    const message: LSPMessage = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.sendMessage(message);
  }

  sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request ${method} timed out after 10 seconds`));
      }, 10000);

      this.responseHandlers.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.sendMessage(message);
    });
  }

  sendMessage(message: LSPMessage): void {
    if (!this.process?.stdin) {
      throw new Error("LSP process not started");
    }

    log("trace", "LSP sending", { message });
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.process.stdin.write(header + content);
  }

  async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      processId: process.pid,
      rootUri: `file://${this.workspaceRoot}`,
      rootPath: this.workspaceRoot,
      workspaceFolders: [
        {
          uri: `file://${this.workspaceRoot}`,
          name: "workspace",
        },
      ],
      capabilities: {
        workspace: {
          workspaceFolders: true,
          configuration: true,
        },
        textDocument: {
          synchronization: {
            openClose: true,
            change: 1,
          },
          publishDiagnostics: {
            relatedInformation: true,
            versionSupport: false,
            tagSupport: {
              valueSet: [1, 2],
            },
          },
          diagnostic: {
            dynamicRegistration: false,
            relatedDocumentSupport: false,
          },
        },
      },
      initializationOptions: {
        preferences: {
          includeInlayParameterNameHints: "all",
          includeInlayParameterNameHintsWhenArgumentMatchesName: true,
          includeInlayFunctionParameterTypeHints: true,
          includeInlayVariableTypeHints: true,
          includeInlayPropertyDeclarationTypeHints: true,
          includeInlayFunctionLikeReturnTypeHints: true,
          includeInlayEnumMemberValueHints: true,
        },
      },
    });

    this.sendMessage({ jsonrpc: "2.0", method: "initialized", params: {} });
  }

  async checkHealth(): Promise<boolean> {
    if (!this.process || this.process.killed) {
      return false;
    }

    try {
      // Send a simple request to check if server responds
      const result = await Promise.race([
        this.sendRequest("window/workDoneProgress/create", {
          token: "health-check",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), 2000),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      try {
        await this.sendRequest("shutdown");
        this.sendMessage({ jsonrpc: "2.0", method: "exit" });

        // Give the process a moment to exit gracefully
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (this.process && !this.process.killed) {
          this.process.kill();
        }
        this.process = null;
        this.isHealthy = false;
      } catch (error) {
        // Force kill if shutdown fails
        if (this.process && !this.process.killed) {
          this.process.kill();
        }
        this.process = null;
        this.isHealthy = false;
      }
    }
  }

  async getDiagnostics(uri: string): Promise<any> {
    // First try the pull-based diagnostic request
    try {
      const result = await this.sendRequest("textDocument/diagnostic", {
        textDocument: { uri },
      });
      return result;
    } catch (error) {
      log("info", "Pull-based diagnostics failed, falling back to push-based");
      // Fall back to push-based diagnostics
      return { diagnostics: this.getDiagnosticsForUri(uri) };
    }
  }

  async getDefinition(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    return this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getReferences(
    uri: string,
    line: number,
    character: number,
    includeDeclaration: boolean = false,
  ): Promise<any> {
    return this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration },
    });
  }

  async getTypeDefinition(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    return this.sendRequest("textDocument/typeDefinition", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getImplementation(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    return this.sendRequest("textDocument/implementation", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getDocumentSymbols(uri: string): Promise<any> {
    return this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
  }

  async getWorkspaceSymbols(query: string): Promise<any> {
    return this.sendRequest("workspace/symbol", {
      query,
    });
  }

  async getHover(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async rename(
    uri: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<any> {
    return this.sendRequest("textDocument/rename", {
      textDocument: { uri },
      position: { line, character },
      newName,
    });
  }

  async getCodeActions(
    uri: string,
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    },
    diagnostics: any[] = [],
  ): Promise<any> {
    return this.sendRequest("textDocument/codeAction", {
      textDocument: { uri },
      range,
      context: { diagnostics },
    });
  }

  async executeCommand(command: string, args?: any[]): Promise<any> {
    return this.sendRequest("workspace/executeCommand", {
      command,
      arguments: args,
    });
  }
}
