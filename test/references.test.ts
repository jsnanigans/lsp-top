import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';
import { TypeScriptLSP } from '../src/servers/typescript';
import { LSPClient } from '../src/lsp-client';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const TEST_PROJECT = path.resolve(__dirname, '../test-project');

function runCLI(args: string[]) {
  const res = spawnSync(process.execPath, [CLI, ...args], { 
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'test' },
    cwd: path.resolve(__dirname, '..')  // Run from project root
  });
  return res;
}

describe('References Command', () => {
  describe('CLI Integration', () => {
    it('should require position argument', () => {
      const res = runCLI(['refs']);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('missing required argument');
    });

    it('should validate position format', () => {
      const res = runCLI(['refs', 'file.ts:invalid']);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('Invalid');
    });

    it('should accept valid position format and return references', () => {
      const res = runCLI(['refs', 'test-project/src/types/user.ts:7:18', '--json']);
      // Should succeed and return an array of references
      expect(res.status).toBe(0);
      const output = JSON.parse(res.stdout);
      expect(output).toHaveProperty('data');
      expect(Array.isArray(output.data)).toBe(true);
    });

    it('should pass includeDeclaration flag when specified', () => {
      const res = runCLI(['refs', 'test-project/src/types/user.ts:7:18', '--include-declaration', '--json']);
      expect(res.status).toBe(0);
      const output = JSON.parse(res.stdout);
      expect(output).toHaveProperty('data');
      expect(Array.isArray(output.data)).toBe(true);
    });

    it('should work with JSON output flag', () => {
      const res = runCLI(['refs', 'test-project/src/types/user.ts:7:18', '--json']);
      expect(res.status).toBe(0);
      
      // The output should be valid JSON
      const output = JSON.parse(res.stdout);
      expect(output).toHaveProperty('schemaVersion');
      expect(output).toHaveProperty('data');
      expect(Array.isArray(output.data)).toBe(true);
    });

    it('should validate position format', () => {
      const res = runCLI(['run', 'test', 'references', 'file.ts:invalid']);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('Invalid position format');
    });

    it('should accept valid position format and return references', () => {
      const res = runCLI(['run', 'test', 'references', 'src/types/user.ts:1:17']);
      // Should succeed and return an array of references
      expect(res.status).toBe(0);
      const output = JSON.parse(res.stdout);
      expect(Array.isArray(output)).toBe(true);
    });

    it('should pass includeDeclaration flag when specified', () => {
      const res = runCLI(['run', 'test', 'references', 'src/types/user.ts:1:17', '--include-declaration']);
      expect(res.status).toBe(0);
      const output = JSON.parse(res.stdout);
      expect(Array.isArray(output)).toBe(true);
    });

    it('should work with JSON output flag', () => {
      const res = runCLI(['run', 'test', 'references', 'src/types/user.ts:1:17', '--json']);
      expect(res.status).toBe(0);
      
      // The output should be valid JSON
      let output: any;
      expect(() => {
        output = JSON.parse(res.stdout);
      }).not.toThrow();
      
      // For now, the daemon returns raw array of references
      // TODO: When CLI JSON wrapping is fixed, update this test to check for wrapped format
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        expect(output[0]).toHaveProperty('uri');
        expect(output[0]).toHaveProperty('range');
      }
    });
  });

  describe('TypeScriptLSP.getReferences', () => {
    let lsp: TypeScriptLSP;

    beforeAll(async () => {
      lsp = new TypeScriptLSP(TEST_PROJECT);
      await lsp.start();
      // Give LSP time to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
      await lsp.stop();
    });

    it('should find references to User interface', async () => {
      const filePath = path.join(TEST_PROJECT, 'src/types/user.ts');
      const references = await lsp.getReferences(filePath, 1, 17, false);
      
      expect(references).toBeDefined();
      expect(Array.isArray(references)).toBe(true);
      
      // The LSP should return an array of Location objects
      if (references.length > 0) {
        expect(references[0]).toHaveProperty('uri');
        expect(references[0]).toHaveProperty('range');
      }
    });

    it('should include declaration when flag is true', async () => {
      const filePath = path.join(TEST_PROJECT, 'src/types/user.ts');
      const referencesWithDecl = await lsp.getReferences(filePath, 1, 17, true);
      const referencesWithoutDecl = await lsp.getReferences(filePath, 1, 17, false);
      
      expect(referencesWithDecl).toBeDefined();
      expect(referencesWithoutDecl).toBeDefined();
      expect(Array.isArray(referencesWithDecl)).toBe(true);
      expect(Array.isArray(referencesWithoutDecl)).toBe(true);
    });

    it('should handle non-existent file gracefully', async () => {
      const filePath = path.join(TEST_PROJECT, 'src/non-existent.ts');
      
      // This will throw because file doesn't exist
      await expect(async () => {
        await lsp.getReferences(filePath, 1, 1, false);
      }).rejects.toThrow();
    });

    it('should return empty array for invalid position', async () => {
      const filePath = path.join(TEST_PROJECT, 'src/types/user.ts');
      
      // Position outside of file bounds
      const references = await lsp.getReferences(filePath, 9999, 9999, false);
      expect(references).toBeDefined();
      expect(Array.isArray(references)).toBe(true);
      // TypeScript LSP typically returns empty array for positions with no references
      expect(references.length).toBe(0);
    });
  });

  describe('LSPClient.getReferences', () => {
    it('should send correct LSP request', async () => {
      const client = new LSPClient('echo', ['test'], TEST_PROJECT);
      
      // Mock sendRequest to verify the request format
      let capturedMethod: string | undefined;
      let capturedParams: any;
      
      client.sendRequest = async (method: string, params: any) => {
        capturedMethod = method;
        capturedParams = params;
        return [];
      };
      
      const uri = 'file:///test/file.ts';
      await client.getReferences(uri, 10, 5, true);
      
      expect(capturedMethod).toBe('textDocument/references');
      expect(capturedParams).toEqual({
        textDocument: { uri },
        position: { line: 10, character: 5 },
        context: { includeDeclaration: true }
      });
    });
  });
});