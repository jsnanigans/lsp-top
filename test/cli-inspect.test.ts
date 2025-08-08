import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const bin = path.join(__dirname, '../dist/cli.js');

describe('CLI analyze', () => {
  it('errors when missing file path for check command', () => {
    const r = spawnSync(process.execPath, [bin, 'check'], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr || r.stdout).toContain('missing required argument');
  });

  it('parses flags for analyze changed command', () => {
    const r = spawnSync(process.execPath, [bin, 'analyze', 'changed', '--staged', '--json'], { 
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '../test-project')
    });
    // Command should at least parse correctly (may fail if no git repo)
    // Just check it doesn't error on unknown options
    expect(r.stderr).not.toContain('Unknown option');
  });
});
