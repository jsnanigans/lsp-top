import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../src/daemon';
import * as net from 'net';
import * as path from 'path';

const SOCKET_PATH = '/tmp/lsp-top-test-references.sock';
const TEST_PROJECT = path.resolve(__dirname, '../test-project');

// NOTE: This test suite requires the daemon to be running with the references handler.
// Enable this test after the daemon code is deployed.
describe.skip('Daemon References Handler', () => {
  let daemon: Daemon;
  
  beforeAll(async () => {
    // Clean up any existing socket
    try {
      require('fs').unlinkSync(SOCKET_PATH);
    } catch {}
    
    // Start daemon with custom socket path
    process.env.LSP_TOP_SOCKET = SOCKET_PATH;
    daemon = new Daemon();
    daemon.start();
    
    // Give daemon time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  afterAll(async () => {
    // Send stop command to daemon
    try {
      const client = net.connect(SOCKET_PATH, () => {
        client.write(JSON.stringify({ action: 'stop' }));
        client.end();
      });
    } catch {}
    
    // Clean up socket
    try {
      require('fs').unlinkSync(SOCKET_PATH);
    } catch {}
  });
  
  function sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = net.connect(SOCKET_PATH, () => {
        client.write(JSON.stringify(request));
      });
      
      let buffer = '';
      client.on('data', (data) => {
        buffer += data.toString();
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const chunk = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 1);
          if (chunk) {
            try {
              const response = JSON.parse(chunk);
              client.end();
              if (response.type === 'error') {
                reject(new Error(response.message));
              } else {
                resolve(response.data);
              }
            } catch (e) {
              reject(e);
            }
          }
          boundary = buffer.indexOf('\n');
        }
      });
      
      client.on('error', reject);
    });
  }
  
  it('should handle references action', async () => {
    const request = {
      alias: 'test-daemon-refs',
      action: 'references',
      args: ['src/types/user.ts:1:17', '{}'],
      projectPath: TEST_PROJECT
    };
    
    const result = await sendRequest(request);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should handle references with includeDeclaration flag', async () => {
    const request = {
      alias: 'test-daemon-refs-decl',
      action: 'references',
      args: ['src/types/user.ts:1:17', JSON.stringify({ includeDeclaration: true })],
      projectPath: TEST_PROJECT
    };
    
    const result = await sendRequest(request);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should error on missing position', async () => {
    const request = {
      alias: 'test-daemon-refs-err',
      action: 'references',
      args: [],
      projectPath: TEST_PROJECT
    };
    
    await expect(sendRequest(request)).rejects.toThrow('File path and position required');
  });
  
  it('should error on invalid position format', async () => {
    const request = {
      alias: 'test-daemon-refs-err2',
      action: 'references',
      args: ['src/types/user.ts:invalid'],
      projectPath: TEST_PROJECT
    };
    
    await expect(sendRequest(request)).rejects.toThrow('Invalid position format');
  });
});