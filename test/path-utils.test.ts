import { describe, it, expect } from 'vitest';
import { gitChangedFiles } from '../src/path-utils';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('gitChangedFiles', () => {
  const repo = path.join(process.cwd(), '.tmp-git');
  const f = path.join(repo, 'x.ts');

  it('lists changed and staged files separately', async () => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.mkdirSync(repo, { recursive: true });
    execSync('git init', { cwd: repo });
    execSync('git config user.email test@example.com', { cwd: repo });
    execSync('git config user.name test', { cwd: repo });
    fs.writeFileSync(f, 'export const z=1\n');
    execSync('git add . && git commit -m init', { cwd: repo });
    fs.writeFileSync(f, 'export const   z=1\n');
    const changed = await gitChangedFiles(repo);
    execSync('git add x.ts', { cwd: repo });
    const staged = await gitChangedFiles(repo, { staged: true });
    expect(changed.some(p => p.endsWith('x.ts'))).toBe(true);
    expect(staged.some(p => p.endsWith('x.ts'))).toBe(true);
  }, 30000);
});
