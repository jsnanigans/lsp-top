import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI = path.resolve(__dirname, '../dist/cli.js');

describe('References Command - Implementation Plan Compliance', () => {
  it('should match the command structure from implementation plan', () => {
    // According to the implementation plan, the command should be:
    // lsp-top run <alias> references <position> [--include-declaration]
    
    // Test the exact command structure
    const res = spawnSync(process.execPath, [
      CLI, 
      'run', 
      'test', 
      'references', 
      'src/types/user.ts:1:17',
      '--include-declaration'
    ], { 
      encoding: 'utf-8' 
    });
    
    // Should succeed with the correct command structure
    expect(res.status).toBe(0);
    const output = JSON.parse(res.stdout);
    expect(Array.isArray(output)).toBe(true);
  });
  
  it('should accept flags as specified in the plan', () => {
    // The plan specifies: flags.includeDeclaration
    const res = spawnSync(process.execPath, [
      CLI,
      'run',
      'test', 
      'references',
      'src/types/user.ts:1:17',
      '--include-declaration'
    ], {
      encoding: 'utf-8'
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
        'run',
        'test',
        'references',
        position
      ], {
        encoding: 'utf-8'
      });
      
      // Should complain about invalid format
      expect(res.stderr).toContain('Invalid position format');
      expect(res.status).not.toBe(0);
    });
  });
});