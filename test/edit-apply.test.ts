import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TypeScriptLSP } from '../src/servers/typescript';
import * as fs from 'fs';
import * as path from 'path';

describe('edit plan/apply', () => {
  const dir = path.join(process.cwd(), '.tmp-edit');
  const file = path.join(dir, 'c.ts');
  let lsp: TypeScriptLSP;

  beforeAll(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, 'export const z=1\n');
    lsp = new TypeScriptLSP(dir);
    await lsp.start();
  }, 60000);

  afterAll(async () => {
    await lsp.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('plans and applies a simple change', async () => {
    const uri = `file://${file}`;
    const plan = {
      changes: {
        [uri]: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            newText: '// header\n'
          }
        ]
      }
    };
    const planned = await lsp.planWorkspaceEdit(JSON.stringify(plan));
    expect(planned).toBeTruthy();
    await lsp.applyWorkspaceEditJson(JSON.stringify(plan));
    const text = fs.readFileSync(file, 'utf-8');
    expect(text.startsWith('// header')).toBe(true);
  }, 60000);
});
