#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config';
import { resolveProjectPath } from './path-utils';
import { TypeScriptLSP } from './servers/typescript';
import * as path from 'path';
import { log, setVerbose } from './logger';

const program = new Command();
const config = new ConfigManager();

program
  .name('lsp-top')
  .description('LSP server wrapper for running language server commands from anywhere')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose logging');

program.on('option:verbose', () => {
  setVerbose(true);
});

program
  .command('init <alias> [path]')
  .description('Initialize a project with an alias')
  .action((alias: string, projectPath?: string) => {
    try {
      const pathToUse = projectPath || process.cwd();
      config.addAlias(alias, pathToUse);
      console.log(`✓ Initialized project '${alias}' at ${path.resolve(pathToUse)}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all project aliases')
  .action(() => {
    const aliases = config.listAliases();
    const entries = Object.entries(aliases);
    
    if (entries.length === 0) {
      console.log('No projects configured. Use "lsp-top init <alias> [path]" to add one.');
      return;
    }
    
    console.log('Configured projects:');
    entries.forEach(([alias, path]) => {
      console.log(`  ${alias} -> ${path}`);
    });
  });

program
  .command('remove <alias>')
  .description('Remove a project alias')
  .action((alias: string) => {
    if (config.removeAlias(alias)) {
      console.log(`✓ Removed project '${alias}'`);
    } else {
      console.error(`Error: Project '${alias}' not found`);
      process.exit(1);
    }
  });

program
  .command('run <alias> <action> [args...]')
  .description('Run an LSP action for a project')
  .action(async (alias: string, action: string, args: string[]) => {
    log(`Running command: alias=${alias}, action=${action}, args=[${args.join(', ')}]`);
    const projectPath = config.getPath(alias);
    
    if (!projectPath) {
      console.error(`Error: Project '${alias}' not found. Use 'lsp-top list' to see available projects.`);
      process.exit(1);
    }
    
    log(`Project path resolved to: ${projectPath}`);
    
    try {
      const lsp = new TypeScriptLSP(projectPath);
      await lsp.start();
      
      switch (action) {
        case 'diagnostics': {
          if (!args[0]) {
            console.error('Error: File path required for diagnostics');
            process.exit(1);
          }
          const filePath = resolveProjectPath(projectPath, args[0]);
          log(`Getting diagnostics for: ${filePath}`);
          const diagnostics = await lsp.getDiagnostics(filePath);
          console.log(JSON.stringify(diagnostics, null, 2));
          break;
        }
        
        case 'definition': {
          if (!args[0]) {
            console.error('Error: File path and position required (e.g., file.ts:10:5)');
            process.exit(1);
          }
          const [fileArg, lineStr, charStr] = args[0].split(':');
          const filePath = resolveProjectPath(projectPath, fileArg);
          const line = parseInt(lineStr, 10);
          const char = parseInt(charStr, 10);
          
          if (isNaN(line) || isNaN(char)) {
            console.error('Error: Invalid position format. Use file.ts:line:column');
            process.exit(1);
          }
          
          log(`Getting definition at ${filePath}:${line}:${char}`);
          const definition = await lsp.getDefinition(filePath, line, char);
          console.log(JSON.stringify(definition, null, 2));
          break;
        }
        
        default:
          console.error(`Error: Unknown action '${action}'`);
          console.log('Available actions: diagnostics, definition');
          process.exit(1);
      }
      
      await lsp.stop();
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program.parse();
