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
  .version(require('../package.json').version);

program
  .command('start-server')
  .description('Start the LSP daemon')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress non-error output')
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
  .command('status')
  .description('Show daemon status')
  .option('--json', 'Output machine-readable JSON only')
  .action(() => {
    const client = net.connect(SOCKET_PATH, () => {
      client.write(JSON.stringify({ action: 'status' }));
    });
    client.on('data', (data) => {
      try {
        const info = JSON.parse(data.toString());
        if (info && info.ok) {
          if (program.opts().json) {
            console.log(JSON.stringify(info));
          } else {
            console.log(`Daemon: running, sessions=${info.sessions}`);
          }
          process.exit(0);
        } else {
          const msg = (info && info.error) || 'Unknown error';
          if (program.opts().json) console.log(JSON.stringify({ ok: false, error: msg, code: 'STATUS_ERROR' }));
          else console.error('Error:', msg);
          process.exit(4);
        }
      } catch {
        console.log(data.toString());
        process.exit(0);
      }
    });
    client.on('error', () => {
      const msg = 'Daemon not running';
      if (program.opts().json) console.log(JSON.stringify({ ok: false, error: msg, code: 'DAEMON_NOT_RUNNING' }));
      else console.error(msg);
      process.exit(5);
    });
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
  .command('configure')
  .description('Show or set configuration')
  .option('--set-alias <alias:path>', 'Set alias mapping, e.g., web:/path')
  .option('--print', 'Print effective config')
  .option('--env <keys>', 'Comma-separated env keys to include in effective config')
  .option('--json', 'Output machine-readable JSON only')
  .action((options) => {
    if (options.setAlias) {
      const [alias, p] = String(options.setAlias).split(':');
      if (!alias || !p) {
        console.error('Error: --set-alias requires format alias:path');
        process.exit(6);
      }
      try {
        config.addAlias(alias, p);
        if (!options.json) console.log(`✓ Set ${alias} -> ${p}`);
        else console.log(JSON.stringify({ ok: true }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (options.json) console.log(JSON.stringify({ ok: false, error: msg, code: 'CONFIG_SET_ERROR' }));
        else console.error('Error:', msg);
        process.exit(7);
      }
      return;
    }

    const keys = options.env ? String(options.env).split(',').map((s) => s.trim()) : [];
    const eff = config.effectiveConfig(keys);
    if (options.json || options.print) {
      console.log(JSON.stringify(eff, null, options.json ? 0 : 2));
    } else {
      console.log('Use --print to display effective config');
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
  .command('diagnose [alias]')
  .description('Diagnose environment and server readiness')
  .option('--json', 'Output machine-readable JSON only')
  .action(async (alias?: string, options?: any) => {
    const checks: any = { ok: true, node: process.version, hasTypescriptServer: false, alias, projectPath: undefined };
    try {
      const pkg = require.resolve('@vtsls/language-server/package.json');
      checks.hasTypescriptServer = !!pkg;
    } catch {
      checks.hasTypescriptServer = false;
      checks.ok = false;
    }
    if (alias) {
      const p = config.getPath(alias);
      checks.projectPath = p;
      if (!p) checks.ok = false;
    }
    if (options?.json) console.log(JSON.stringify(checks));
    else console.log(JSON.stringify(checks, null, 2));
    process.exit(checks.ok ? 0 : 8);
  });

program
  .command('run <alias> <action> [args...]')
  .description('Run an LSP action for a project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--json', 'Output machine-readable JSON only')
  .action(async (alias: string, action: string, args: string[], options) => {
    setVerbose(options.verbose);
    const projectPath = config.getPath(alias);
    if (!projectPath) {
      const msg = `Project '${alias}' not found. Use 'lsp-top list' to see available projects.`;
      if (options.json) {
        console.log(JSON.stringify({ ok: false, error: msg, code: 'ALIAS_NOT_FOUND' }));
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exit(2);
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
                    if (response.type === 'log' && options.verbose && !options.json) {
                        console.log(response.data);
                    } else if (response.type === 'result') {
                        if (options.json) {
                            console.log(JSON.stringify({ ok: true, data: response.data }));
                        } else {
                            console.log(JSON.stringify(response.data, null, 2));
                        }
                    } else if (response.type === 'error') {
                        if (options.json) {
                            console.log(JSON.stringify({ ok: false, error: response.message, code: response.code || 'DAEMON_ERROR' }));
                        } else {
                            console.error('Error:', response.message);
                        }
                    }                } catch (e) {
                    console.error('Error parsing daemon response:', e, 'Chunk:', chunk);
                }
            }
            boundary = buffer.indexOf('\n');
        }
    });

    client.on('error', (err) => {
      const msg = 'Failed to connect to daemon. Is it running?';
      if (options.json) {
        console.log(JSON.stringify({ ok: false, error: msg, code: 'DAEMON_UNAVAILABLE' }));
      } else {
        console.error(msg);
      }
      log('Connection error:', err.message);
      process.exit(3);
    });
  });

program.parse(process.argv);
