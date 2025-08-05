import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TypeScriptLSP } from '../src/servers/typescript';
import * as fs from 'fs';
import * as path from 'path';

describe('inspect pipeline', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-inspect');
  const file = path.join(tmpDir, 'sample.ts');
  let lsp: TypeScriptLSP;

  beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(file, 'const   a=1\nexport {a}\n');
    lsp = new TypeScriptLSP(process.cwd());
    await lsp.start();
  }, 30000);

  afterAll(async () => {
    await lsp.stop();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('returns diagnostics and edits for format and organize imports', async () => {
    const res = await lsp.inspectFile(file, { format: true, organizeImports: true });
    expect(res).toBeTruthy();
    expect(res.diagnostics).toBeDefined();
    expect(typeof res.edits).toBe('object');
  }, 30000);
});
