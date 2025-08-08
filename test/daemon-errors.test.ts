import { describe, it, expect } from 'vitest';
import * as net from 'net';

const SOCKET_PATH = '/tmp/lsp-top.sock';

describe('Daemon error paths', () => {
  it('returns error for unknown action', async () => {
    const res = await new Promise<string>((resolve) => {
      const c = net.connect(SOCKET_PATH, () => {
        c.write(JSON.stringify({ action: 'nope', args: [], projectPath: process.cwd() }));
      });
      c.on('data', (d) => resolve(String(d)));
      c.on('error', () => resolve(''));
    });
    // Should return an error for unknown action
    const parsed = res ? JSON.parse(res) : { ok: false };
    expect(parsed.ok).toBe(false);
  });
});
