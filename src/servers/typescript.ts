import { LSPClient } from "../lsp-client";
import * as path from "path";
import * as fs from "fs";
import { log, time } from "../logger";

type WorkspaceTextEdit = {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
};

type WorkspaceEdit = {
  documentChanges?: {
    textDocument: { uri: string };
    edits: WorkspaceTextEdit[];
  }[];
  changes?: Record<string, WorkspaceTextEdit[]>;
};

export class TypeScriptLSP {
  private client: LSPClient;
  private openDocuments = new Set<string>();

  constructor(private workspaceRoot: string) {
    const vtsls = this.findVtsls();
    log("info", "Using vtsls", { path: vtsls });
    this.client = new LSPClient(vtsls, ["--stdio"], workspaceRoot);
  }

  private findVtsls(): string {
    const possiblePaths = [
      path.join(this.workspaceRoot, "node_modules/.bin/vtsls"),
      path.join(process.cwd(), "node_modules/.bin/vtsls"),
      "vtsls", // Try global/PATH installation
    ];

    for (const vtsPath of possiblePaths) {
      log("debug", "Checking for vtsls", { path: vtsPath });
      if (vtsPath === "vtsls" || fs.existsSync(vtsPath)) {
        return vtsPath;
      }
    }

    throw new Error(
      "vtsls language server not found. Make sure @vtsls/language-server is installed.",
    );
  }

  async start(): Promise<void> {
    await time("typescript.start", async () => {
      await this.client.start();
      await this.client.initialize();
    });
  }

  async stop(): Promise<void> {
    await this.client.shutdown();
  }

  async checkHealth(): Promise<boolean> {
    return await this.client.checkHealth();
  }

  async getDiagnostics(filePath: string): Promise<any> {
    const uri = `file://${filePath}`;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log("warn", "File not found for diagnostics", { filePath });
      return {
        diagnostics: [],
        error: `File not found: ${path.basename(filePath)}`,
      };
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      log("error", "Failed to read file", { filePath, error: String(error) });
      return {
        diagnostics: [],
        error: `Cannot read file: ${path.basename(filePath)}`,
      };
    }

    // Always close and reopen to avoid state issues
    if (this.openDocuments.has(uri)) {
      // Close the document first
      log("debug", "Closing document before reopening", { uri });
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didClose",
        params: {
          textDocument: { uri },
        },
      });
      this.openDocuments.delete(uri);
      // Small delay to ensure close is processed
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Open the document fresh
    log("info", "Opening document for diagnostics", { uri });
    this.client.sendMessage({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          languageId:
            path.extname(filePath) === ".tsx"
              ? "typescriptreact"
              : "typescript",
          version: 1,
          text: content,
        },
      },
    });
    this.openDocuments.add(uri);

    // Wait for diagnostics to be published
    log("debug", "Waiting for diagnostics to be published...");

    // Try multiple times with shorter waits
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const diagnostics = this.client.getDiagnosticsForUri(uri);
      if (diagnostics.length > 0 || attempt === 4) {
        log("info", "Diagnostics check complete", {
          uri,
          count: diagnostics.length,
          attempt: attempt + 1,
        });
        return { diagnostics };
      }
    }

    // Return empty diagnostics if none found
    return { diagnostics: [] };
  }

  async getDefinition(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.definition", async () =>
      this.client.getDefinition(uri, line - 1, character - 1),
    );
  }

  async getReferences(
    filePath: string,
    line: number,
    character: number,
    includeDeclaration: boolean = false,
  ): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.references", async () =>
      this.client.getReferences(
        uri,
        line - 1,
        character - 1,
        includeDeclaration,
      ),
    );
  }

  async getTypeDefinition(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.typeDefinition", async () =>
      this.client.getTypeDefinition(uri, line - 1, character - 1),
    );
  }

  async getImplementation(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.implementation", async () =>
      this.client.getImplementation(uri, line - 1, character - 1),
    );
  }

  async getDocumentSymbols(filePath: string): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.documentSymbols", async () =>
      this.client.getDocumentSymbols(uri),
    );
  }

  async getHover(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;
    const content = fs.readFileSync(filePath, "utf-8");

    if (!this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: content,
          },
        },
      });
      this.openDocuments.add(uri);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return await time("typescript.hover", async () =>
      this.client.getHover(uri, line - 1, character - 1),
    );
  }

  private async codeActions(
    uri: string,
    diagnostics: any[],
    kinds: string[],
  ): Promise<any[]> {
    let actions: any[] = [];
    try {
      const filePath = uri.replace(/^file:\/\//, "");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const fullRange = {
        start: { line: 0, character: 0 },
        end: {
          line: Math.max(0, lines.length - 1),
          character: lines[lines.length - 1]?.length || 0,
        },
      };
      const res = await this.client.sendRequest("textDocument/codeAction", {
        textDocument: { uri },
        range: fullRange,
        context: { diagnostics, only: kinds },
      });
      actions = Array.isArray(res) ? res : [];
    } catch {}
    const resolved: any[] = [];
    for (const a of actions) {
      if (a && (a.edit || a.command == null)) {
        resolved.push(a);
      } else {
        try {
          const ra = await this.client.sendRequest("codeAction/resolve", a);
          resolved.push(ra || a);
        } catch {
          resolved.push(a);
        }
      }
    }
    return resolved;
  }

  private async format(uri: string): Promise<any[]> {
    try {
      const edits = await this.client.sendRequest("textDocument/formatting", {
        textDocument: { uri },
        options: { tabSize: 2, insertSpaces: true },
      });
      return Array.isArray(edits) ? edits : [];
    } catch {
      return [];
    }
  }

  async organizeImports(filePath: string): Promise<any> {
    const uri = `file://${filePath}`;
    const action = await this.client.sendRequest("workspace/executeCommand", {
      command: "_typescript.organizeImports",
      arguments: [{ scope: { type: "file", args: { uri } } }],
    });
    const edits = Array.isArray(action) ? action : [];
    return { changes: { [uri]: edits } };
  }

  async rename(
    filePath: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<any> {
    const uri = `file://${filePath}`;

    // Open document if not already open
    if (!this.openDocuments.has(uri)) {
      const content = require("fs").readFileSync(filePath, "utf-8");
      await this.client.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "typescript",
          version: 1,
          text: content,
        },
      });
      this.openDocuments.add(uri);
    }

    return await time("typescript.rename", async () =>
      this.client.rename(uri, line, character, newName),
    );
  }

  async inspectFile(
    filePath: string,
    flags: {
      fix?: boolean;
      fixDry?: boolean;
      organizeImports?: boolean;
      format?: boolean;
      write?: boolean;
    } = {},
  ) {
    const uri = `file://${filePath}`;
    await this.getDiagnostics(filePath);
    const diagnostics = this.client.getDiagnosticsForUri(uri);
    const edits: { documentChanges?: any[]; changes?: Record<string, any[]> } =
      { changes: {} };
    const actionsApplied: string[] = [];

    if (flags.organizeImports) {
      const result = await this.organizeImports(filePath);
      if (result.changes && result.changes[uri]) {
        edits.changes![uri] = (edits.changes![uri] || []).concat(
          result.changes[uri],
        );
        actionsApplied.push("organizeImports");
      }
    }
    if (flags.format) {
      const fmt = await this.format(uri);
      if (fmt.length) {
        edits.changes![uri] = (edits.changes![uri] || []).concat(fmt);
        actionsApplied.push("format");
      }
    }
    if (flags.fix || flags.fixDry) {
      const kinds = [
        "quickfix",
        "source.fixAll",
        "source.fixAll.ts",
        "source.removeUnused",
        "source.removeUnused.ts",
      ];
      const actions = await this.codeActions(uri, diagnostics, kinds);
      for (const a of actions) {
        if (a && a.edit) {
          if (a.edit.documentChanges) {
            edits.documentChanges = (edits.documentChanges || []).concat(
              a.edit.documentChanges,
            );
          }
          if (a.edit.changes) {
            for (const k of Object.keys(a.edit.changes)) {
              edits.changes![k] = (edits.changes![k] || []).concat(
                a.edit.changes[k],
              );
            }
          }
          if (a.title) actionsApplied.push(String(a.title));
        }
      }
      if (flags.write && !flags.fixDry) {
        for (const a of actions) {
          if (a && a.command && !a.edit) {
            try {
              await this.client.sendRequest(
                "workspace/executeCommand",
                a.command,
              );
              if (a.title) actionsApplied.push(String(a.title));
            } catch {}
          }
        }
      }
    }

    if (flags.write) {
      await this.applyWorkspaceEdit(edits);
      await new Promise((r) => setTimeout(r, 200));
    }

    const res = { diagnostics, actionsApplied, edits };
    return res;
  }

  async planWorkspaceEdit(raw: string) {
    const edit = JSON.parse(raw) as WorkspaceEdit;
    return this.normalizeWorkspaceEdit(edit);
  }

  async applyWorkspaceEditJson(raw: string) {
    const edit = JSON.parse(raw) as WorkspaceEdit;
    const planned = this.normalizeWorkspaceEdit(edit);
    await this.applyWorkspaceEdit(planned);
    return { ok: true };
  }

  private normalizeWorkspaceEdit(edit: WorkspaceEdit): WorkspaceEdit {
    const out: WorkspaceEdit = { changes: {} };
    if (edit.documentChanges && Array.isArray(edit.documentChanges)) {
      out.documentChanges = [];
      for (const dc of edit.documentChanges) {
        if (dc && dc.textDocument && Array.isArray(dc.edits)) {
          out.documentChanges.push({
            textDocument: { uri: dc.textDocument.uri },
            edits: dc.edits,
          });
        }
      }
    }
    if (edit.changes) {
      for (const [uri, edits] of Object.entries(edit.changes)) {
        out.changes![uri] = edits;
      }
    }
    return out;
  }

  private async applyWorkspaceEdit(edit: WorkspaceEdit) {
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
    const filePath = uri.replace(/^file:\/\//, "");
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const sorted = [...edits].sort((a, b) => {
      const sa = a.range.start;
      const sb = b.range.start;
      if (sa.line !== sb.line) return sb.line - sa.line;
      return sb.character - sa.character;
    });
    let text = content;
    for (const e of sorted) {
      const start = this.offsetOf(
        lines,
        e.range.start.line,
        e.range.start.character,
      );
      const end = this.offsetOf(lines, e.range.end.line, e.range.end.character);
      text = text.slice(0, start) + (e.newText || "") + text.slice(end);
    }
    fs.writeFileSync(filePath, text, "utf-8");
    if (this.openDocuments.has(uri)) {
      this.client.sendMessage({
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, version: Date.now() },
          contentChanges: [{ text }],
        },
      });
    }
  }

  private offsetOf(lines: string[], line: number, ch: number) {
    let off = 0;
    for (let i = 0; i < line; i++) off += lines[i].length + 1;
    return off + ch;
  }

  async inspectChanged(
    flags: {
      staged?: boolean;
      fix?: boolean;
      fixDry?: boolean;
      organizeImports?: boolean;
      format?: boolean;
      write?: boolean;
    } = {},
  ) {
    const { gitChangedFiles } = await import("../path-utils");
    const files = await gitChangedFiles(this.workspaceRoot, {
      staged: !!flags.staged,
    });
    const out: Record<string, any> = {};
    for (const f of files.filter(
      (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
    )) {
      out[f] = await this.inspectFile(f, flags as any);
    }
    return out;
  }

  async getWorkspaceSymbols(query: string): Promise<any> {
    return await time("typescript.workspaceSymbols", async () =>
      this.client.getWorkspaceSymbols(query),
    );
  }

  async prepareCallHierarchy(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;

    // Open document if not already open
    if (!this.openDocuments.has(uri)) {
      const content = require("fs").readFileSync(filePath, "utf-8");
      await this.client.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "typescript",
          version: 1,
          text: content,
        },
      });
      this.openDocuments.add(uri);
    }

    return await this.client.sendRequest("textDocument/prepareCallHierarchy", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getIncomingCalls(item: any): Promise<any> {
    return await this.client.sendRequest("callHierarchy/incomingCalls", {
      item,
    });
  }

  async getOutgoingCalls(item: any): Promise<any> {
    return await this.client.sendRequest("callHierarchy/outgoingCalls", {
      item,
    });
  }

  async prepareTypeHierarchy(
    filePath: string,
    line: number,
    character: number,
  ): Promise<any> {
    const uri = `file://${filePath}`;

    // Open document if not already open
    if (!this.openDocuments.has(uri)) {
      const content = require("fs").readFileSync(filePath, "utf-8");
      await this.client.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "typescript",
          version: 1,
          text: content,
        },
      });
      this.openDocuments.add(uri);
    }

    return await this.client.sendRequest("textDocument/prepareTypeHierarchy", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getSupertypes(item: any): Promise<any> {
    return await this.client.sendRequest("typeHierarchy/supertypes", {
      item,
    });
  }

  async getSubtypes(item: any): Promise<any> {
    return await this.client.sendRequest("typeHierarchy/subtypes", {
      item,
    });
  }

  async getAllTypeScriptFiles(): Promise<string[]> {
    const { glob } = require("glob");

    // Find all TypeScript files in the workspace
    const pattern = "**/*.{ts,tsx}";
    try {
      const files = await glob(pattern, {
        cwd: this.workspaceRoot,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.git/**",
          "**/coverage/**",
        ],
        absolute: true,
      });

      return files as string[];
    } catch (error) {
      log("error", "Failed to glob TypeScript files", { error: String(error) });
      return [];
    }
  }
}
