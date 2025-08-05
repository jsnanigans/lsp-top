import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TypeScriptLSP } from '../src/servers/typescript';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('inspect changed', () => {
  const repo = path.join(process.cwd(), '.tmp-repo');
  const file = path.join(repo, 'a.ts');
  let lsp: TypeScriptLSP;

  beforeAll(async () => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.mkdirSync(repo, { recursive: true });
    execSync('git init', { cwd: repo });
    execSync('git config user.email test@example.com', { cwd: repo });
    execSync('git config user.name test', { cwd: repo });
    fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"tmp","version":"1.0.0"}');
    fs.writeFileSync(file, 'export const x=1\n');
    execSync('git add . && git commit -m init', { cwd: repo });
    fs.writeFileSync(file, 'export const   x=1\n');
    lsp = new TypeScriptLSP(repo);
    await lsp.start();
  }, 60000);

  afterAll(async () => {
    await lsp.stop();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('returns entries for changed files', async () => {
    const res = await lsp.inspectChanged({ format: true });
    expect(Object.keys(res).length).toBeGreaterThan(0);
    expect(res[file]).toBeDefined();
  }, 60000);
});
