import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TypeScriptLSP } from '../src/servers/typescript';
import * as fs from 'fs';
import * as path from 'path';

describe('inspect write', () => {
  const dir = path.join(process.cwd(), '.tmp-write');
  const file = path.join(dir, 'b.ts');
  let lsp: TypeScriptLSP;

  beforeAll(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, 'export const   y=1\n');
    lsp = new TypeScriptLSP(dir);
    await lsp.start();
  }, 60000);

  afterAll(async () => {
    await lsp.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('applies edits when --write is set', async () => {
    const res = await lsp.inspectFile(file, { format: true, write: true });
    const text = fs.readFileSync(file, 'utf-8');
    expect(text.includes('const   ')).toBe(false);
  }, 60000);
});
