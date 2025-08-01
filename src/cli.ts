#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config';
import * as path from 'path';
import { log, setVerbose } from './logger';
import * as net from 'net';
import { spawn } from 'child_process';
import * as fs from 'fs';

const SOCKET_PATH = '/tmp/lsp-top.sock';
const LOG_FILE = '/tmp/lsp-top.log';

const program = new Command();
const config = new ConfigManager();

program
  .name('lsp-top')
  .description('LSP server wrapper for running language server commands from anywhere')
  .version('0.1.0');

program
  .command('start-server')
  .description('Start the LSP daemon')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((options) => {
    const args = options.verbose ? ['--verbose'] : [];
    const daemon = spawn(process.argv[0], [path.resolve(__dirname, 'daemon.js'), ...args], {
      detached: true,
      stdio: 'ignore',
    });
    daemon.unref();
    console.log('LSP daemon started.');
  });

program
  .command('stop-server')
  .description('Stop the LSP daemon')
  .action(() => {
    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: 'stop' }));
    });

    client.on('data', () => {
      console.log('LSP daemon stopped.');
      client.end();
    });

    client.on('error', () => {
      console.error('Failed to connect to daemon. Is it running?');
      process.exit(1);
    });
  });

program
    .command('logs')
    .description('Show daemon logs')
    .action(() => {
        if (fs.existsSync(LOG_FILE)) {
            console.log(fs.readFileSync(LOG_FILE, 'utf-8'));
        } else {
            console.log('Log file not found.');
        }
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
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (alias: string, action: string, args: string[], options) => {
    setVerbose(options.verbose);
    const projectPath = config.getPath(alias);
    if (!projectPath) {
      console.error(`Error: Project '${alias}' not found. Use 'lsp-top list' to see available projects.`);
      process.exit(1);
    }

    const client = net.connect(SOCKET_PATH, () => {
      const request = {
        alias,
        action,
        args,
        projectPath,
        verbose: options.verbose,
      };
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
                    if (response.type === 'log' && options.verbose) {
                        console.log(response.data);
                    } else if (response.type === 'result') {
                        console.log(JSON.stringify(response.data, null, 2));
                    } else if (response.type === 'error') {
                        console.error('Error:', response.message);
                    }
                } catch (e) {
                    console.error('Error parsing daemon response:', e, 'Chunk:', chunk);
                }
            }
            boundary = buffer.indexOf('\n');
        }
    });

    client.on('error', (err) => {
      console.error('Failed to connect to daemon. Is it running?');
      log('Connection error:', err.message);
      process.exit(1);
    });
  });

program.parse(process.argv);
