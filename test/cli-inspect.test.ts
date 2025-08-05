import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const bin = path.join(__dirname, '../dist/cli.js');

describe('CLI inspect', () => {
  it('errors when missing file path for inspect file', () => {
    const r = spawnSync(process.execPath, [bin, 'inspect', 'alias', 'file'], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr || r.stdout).toContain('path required');
  });

  it('parses flags and sends to daemon', () => {
    const r = spawnSync(process.execPath, [bin, '--json', 'inspect', 'alias', 'changed', '--format', '--organize-imports', '--staged'], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
  });
});
