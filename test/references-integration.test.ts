import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI = path.resolve(__dirname, '../dist/cli.js');

describe('References Command - New Unix-style Structure', () => {
  it('should match the new command structure', () => {
    // New command structure: lsp-top refs <position> [--include-declaration]
    
    // Test the exact command structure
    const res = spawnSync(process.execPath, [
      CLI, 
      'refs', 
      'test-project/src/types/user.ts:7:18',
      '--include-declaration',
      '--json'
    ], { 
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..')
    });
    
    // Should succeed with the correct command structure
    expect(res.status).toBe(0);
    const output = JSON.parse(res.stdout);
    expect(output).toHaveProperty('data');
    expect(Array.isArray(output.data)).toBe(true);
  });
  
  it('should accept flags as specified', () => {
    const res = spawnSync(process.execPath, [
      CLI,
      'refs',
      'test-project/src/types/user.ts:7:18',
      '--include-declaration',
      '--json'
    ], {
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..')
    });
    
    // The flag should be recognized by the CLI parser
    expect(res.stderr).not.toContain('Unknown option');
    expect(res.status).toBe(0);
  });
  
  it('should follow the position format file:line:column', () => {
    // Test position format validation
    const invalidFormats = [
      'file.ts:invalid',
      'file.ts:10',
      'file.ts'
    ];
    
    invalidFormats.forEach(position => {
      const res = spawnSync(process.execPath, [
        CLI,
        'refs',
        position
      ], {
        encoding: 'utf-8',
        cwd: path.resolve(__dirname, '..')
      });
      
      // Should complain about invalid format
      expect(res.stderr).toContain('Invalid position format');
      expect(res.status).not.toBe(0);
    });
  });
});