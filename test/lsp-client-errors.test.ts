import { describe, it, expect } from 'vitest';
import { LSPClient } from '../src/lsp-client';

describe('lsp-client errors', () => {
  it('throws if not started', async () => {
    const c = new LSPClient('node', ['-e', 'setTimeout(()=>{}, 60000)'], process.cwd());
    expect(() => c.sendMessage({ jsonrpc: '2.0', method: 'noop' as any })).toThrow(/not started/);
  });
});
