#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const config_1 = require("./config");
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const errors_1 = require("./errors");
const net = __importStar(require("net"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const SOCKET_PATH = '/tmp/lsp-top.sock';
const LOG_FILE = '/tmp/lsp-top.log';
const program = new commander_1.Command();
const config = new config_1.ConfigManager();
program
    .name('lsp-top')
    .description('LSP server wrapper for running language server commands from anywhere')
    .version((() => {
    try {
        return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')).version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
})())
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--json', 'Output machine-readable JSON only')
    .option('--log-level <level>', 'Set log level (error|warn|info|debug|trace)')
    .option('--trace <flags>', 'Comma-separated trace flags');
program
    .command('start-server')
    .description('Start the LSP daemon')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--log-level <level>', 'Set log level (error|warn|info|debug|trace)')
    .option('--trace <flags>', 'Comma-separated trace flags')
    .action((options) => {
    const args = [];
    if (options.verbose)
        args.push('--verbose');
    if (options.logLevel)
        args.push('--log-level', String(options.logLevel));
    if (options.trace)
        args.push('--trace', String(options.trace));
    const daemon = (0, child_process_1.spawn)(process.argv[0], [path.resolve(__dirname, 'daemon.js'), ...args], {
        detached: true,
        stdio: 'ignore',
    });
    daemon.unref();
    (0, errors_1.printTextAndExit)('LSP daemon started.');
});
program
    .command('metrics').description('Show daemon status')
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
                    (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: true, data: info }));
                }
                else {
                    (0, errors_1.printTextAndExit)(`Daemon: running, sessions=${info.sessions}`);
                }
            }
            else {
                const msg = (info && info.error) || 'Unknown error';
                if (program.opts().json)
                    (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'STATUS_ERROR' }), 'STATUS_ERROR');
                else
                    (0, errors_1.printTextAndExit)(`Error: ${msg}`, true, 'STATUS_ERROR');
            }
        }
        catch {
            (0, errors_1.printTextAndExit)(data.toString());
        }
    });
    client.on('error', () => {
        const msg = 'Daemon not running';
        if (program.opts().json)
            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'DAEMON_NOT_RUNNING' }), 'DAEMON_NOT_RUNNING');
        else
            (0, errors_1.printTextAndExit)(msg, true, 'DAEMON_NOT_RUNNING');
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
        (0, errors_1.printTextAndExit)('Failed to connect to daemon. Is it running?', true, 'DAEMON_UNAVAILABLE');
    });
});
program
    .command('logs')
    .description('Show daemon logs')
    .option('--tail <n>', 'Tail last N lines')
    .option('--follow', 'Follow log output')
    .action((options) => {
    const pidFile = '/tmp/lsp-top.pid';
    const pid = fs.existsSync(pidFile) ? parseInt(fs.readFileSync(pidFile, 'utf-8'), 10) : null;
    const levelInfo = (() => {
        try {
            const content = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : '';
            const lines = content.trim().split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                try {
                    const obj = JSON.parse(line);
                    if (obj && typeof obj.level === 'string')
                        return obj.level;
                }
                catch { }
            }
            return null;
        }
        catch {
            return null;
        }
    })();
    if (!fs.existsSync(LOG_FILE)) {
        (0, errors_1.printTextAndExit)('Log file not found.', true, 'STATUS_ERROR');
        return;
    }
    const readAll = () => fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
    const printHeader = () => {
        console.log(`PID: ${pid ?? 'unknown'}`);
        console.log(`Level: ${levelInfo ?? 'unknown'}`);
        console.log('---');
    };
    const output = (lines) => {
        const filtered = lines.filter(Boolean);
        if (options.tail) {
            const n = parseInt(String(options.tail), 10);
            const start = Math.max(0, filtered.length - (isNaN(n) ? 50 : n));
            filtered.slice(start).forEach((l) => console.log(l));
        }
        else {
            filtered.forEach((l) => console.log(l));
        }
    };
    if (options.follow) {
        printHeader();
        let lastSize = fs.statSync(LOG_FILE).size;
        output(readAll());
        const interval = setInterval(() => {
            try {
                const stat = fs.statSync(LOG_FILE);
                if (stat.size > lastSize) {
                    const content = fs.readFileSync(LOG_FILE, 'utf-8');
                    const lines = content.split('\n');
                    output(lines);
                    lastSize = stat.size;
                }
            }
            catch { }
        }, 1000);
        process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
        process.on('SIGTERM', () => { clearInterval(interval); process.exit(0); });
    }
    else {
        printHeader();
        output(readAll());
    }
});
program
    .command('init <alias> [path]')
    .description('Initialize a project with an alias')
    .action((alias, projectPath) => {
    try {
        const pathToUse = projectPath || process.cwd();
        config.addAlias(alias, pathToUse);
        (0, errors_1.printTextAndExit)(`✓ Initialized project '${alias}' at ${path.resolve(pathToUse)}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        (0, errors_1.printTextAndExit)(`Error: ${msg}`, true, 'GENERAL_ERROR');
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
            (0, errors_1.printTextAndExit)('Error: --set-alias requires format alias:path', true, 'BAD_FLAG');
        }
        try {
            config.addAlias(alias, p);
            if (!options.json)
                (0, errors_1.printTextAndExit)(`✓ Set ${alias} -> ${p}`);
            else
                (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: true }));
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (options.json)
                (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'CONFIG_SET_ERROR' }), 'CONFIG_SET_ERROR');
            else
                (0, errors_1.printTextAndExit)(`Error: ${msg}`, true, 'CONFIG_SET_ERROR');
        }
        return;
    }
    const keys = options.env ? String(options.env).split(',').map((s) => s.trim()) : [];
    const eff = config.effectiveConfig(keys);
    if (options.json || options.print) {
        console.log(JSON.stringify(eff, null, options.json ? 0 : 2));
    }
    else {
        (0, errors_1.printTextAndExit)('Use --print to display effective config');
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
    (0, errors_1.printTextAndExit)('Configured projects:');
    entries.forEach(([alias, path]) => {
        console.log(`  ${alias} -> ${path}`);
    });
});
program
    .command('remove <alias>')
    .description('Remove a project alias')
    .action((alias) => {
    if (config.removeAlias(alias)) {
        (0, errors_1.printTextAndExit)(`✓ Removed project '${alias}'`);
    }
    else {
        (0, errors_1.printTextAndExit)(`Error: Project '${alias}' not found`, true, 'ALIAS_NOT_FOUND');
    }
});
program
    .command('diagnose [alias]')
    .description('Diagnose environment and server readiness')
    .option('--json', 'Output machine-readable JSON only')
    .action(async (alias, options) => {
    const checks = { ok: true, node: process.version, hasTypescriptServer: false, alias, projectPath: undefined };
    try {
        const pkg = require.resolve('@vtsls/language-server/package.json');
        checks.hasTypescriptServer = !!pkg;
    }
    catch {
        checks.hasTypescriptServer = false;
        checks.ok = false;
    }
    if (alias) {
        const p = config.getPath(alias);
        checks.projectPath = p;
        if (!p)
            checks.ok = false;
    }
    if (options?.json)
        (0, errors_1.printJsonAndExit)(checks, checks.ok ? 'OK' : 'DIAGNOSE_FAILED');
    else
        (0, errors_1.printTextAndExit)(JSON.stringify(checks, null, 2), !checks.ok, checks.ok ? 'OK' : 'DIAGNOSE_FAILED');
});
program
    .command('inspect <alias> <mode> [path]')
    .description('Inspect files for diagnostics and candidate edits')
    .option('--fix', 'Apply quick fixes (preview)')
    .option('--fix-dry', 'Plan fixes without applying')
    .option('--organize-imports', 'Organize imports')
    .option('--format', 'Format files')
    .option('--write', 'Apply edits to disk')
    .option('--staged', 'Limit to staged changes for changed mode')
    .option('--json', 'Output machine-readable JSON only')
    .action(async (alias, mode, filePath, options) => {
    if (mode === 'file' && !filePath) {
        (0, errors_1.printTextAndExit)('Error: path required for inspect file', true, 'BAD_FLAG');
    }
    const level = (options.logLevel ? String(options.logLevel) : (options.verbose ? 'debug' : 'info'));
    (0, logger_1.setLogLevel)(level);
    if (options.trace)
        (0, logger_1.setTraceFlags)(String(options.trace).split(',').map((s) => s.trim()).filter(Boolean));
    const projectPath = config.getPath(alias);
    if (!projectPath) {
        const msg = `Project '${alias}' not found. Use 'lsp-top list' to see available projects.`;
        if (options.json) {
            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'ALIAS_NOT_FOUND' }), 'ALIAS_NOT_FOUND');
        }
        else {
            (0, errors_1.printTextAndExit)(`Error: ${msg}`, true, 'ALIAS_NOT_FOUND');
        }
    }
    const client = net.connect(SOCKET_PATH, () => {
        const flags = JSON.stringify({ fix: !!options.fix, fixDry: !!options.fixDry, organizeImports: !!options.organizeImports, format: !!options.format, write: !!options.write, staged: !!options.staged });
        const action = mode === 'file' ? 'inspect:file' : 'inspect:changed';
        const args = mode === 'file' ? [String(filePath || ''), flags] : [flags];
        client.write(JSON.stringify({ alias, action, args, projectPath, verbose: options.verbose, logLevel: level, trace: options.trace || '' }));
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
                    if (response.type === 'result') {
                        if (options.json)
                            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: true, data: response.data }));
                        else
                            (0, errors_1.printTextAndExit)(JSON.stringify(response.data, null, 2));
                    }
                    else if (response.type === 'error') {
                        if (options.json)
                            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: response.message, code: response.code || 'DAEMON_UNAVAILABLE' }), 'DAEMON_UNAVAILABLE');
                        else
                            (0, errors_1.printTextAndExit)(`Error: ${response.message}`, true, 'DAEMON_UNAVAILABLE');
                    }
                }
                catch { }
            }
            boundary = buffer.indexOf('\n');
        }
    });
    client.on('error', () => {
        const msg = 'Failed to connect to daemon. Is it running?';
        if (options.json)
            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'DAEMON_UNAVAILABLE' }), 'DAEMON_UNAVAILABLE');
        else
            (0, errors_1.printTextAndExit)(msg, true, 'DAEMON_UNAVAILABLE');
    });
});
program
    .command('run <alias> <action> [args...]')
    .description('Run an LSP action for a project')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--json', 'Output machine-readable JSON only')
    .option('--log-level <level>', 'Set log level (error|warn|info|debug|trace)')
    .option('--trace <flags>', 'Comma-separated trace flags')
    .action(async (alias, action, args, options) => {
    const level = (options.logLevel ? String(options.logLevel) : (options.verbose ? 'debug' : 'info'));
    (0, logger_1.setLogLevel)(level);
    if (options.trace)
        (0, logger_1.setTraceFlags)(String(options.trace).split(',').map((s) => s.trim()).filter(Boolean));
    const projectPath = config.getPath(alias);
    if (!projectPath) {
        const msg = `Project '${alias}' not found. Use 'lsp-top list' to see available projects.`;
        if (options.json) {
            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'ALIAS_NOT_FOUND' }), 'ALIAS_NOT_FOUND');
        }
        else {
            (0, errors_1.printTextAndExit)(`Error: ${msg}`, true, 'ALIAS_NOT_FOUND');
        }
    }
    const client = net.connect(SOCKET_PATH, () => {
        const request = {
            alias,
            action,
            args,
            projectPath,
            verbose: options.verbose,
            logLevel: level,
            trace: options.trace || ''
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
                    }
                    else if (response.type === 'result') {
                        if (options.json) {
                            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: true, data: response.data }));
                        }
                        else {
                            (0, errors_1.printTextAndExit)(JSON.stringify(response.data, null, 2));
                        }
                    }
                    else if (response.type === 'error') {
                        if (options.json) {
                            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: response.message, code: response.code || 'DAEMON_UNAVAILABLE' }), 'DAEMON_UNAVAILABLE');
                        }
                        else {
                            (0, errors_1.printTextAndExit)(`Error: ${response.message}`, true, 'DAEMON_UNAVAILABLE');
                        }
                    }
                }
                catch (e) {
                    console.error('Error parsing daemon response:', e, 'Chunk:', chunk);
                }
            }
            boundary = buffer.indexOf('\n');
        }
    });
    client.on('error', (err) => {
        const msg = 'Failed to connect to daemon. Is it running?';
        if (options.json) {
            (0, errors_1.printJsonAndExit)((0, errors_1.result)({ ok: false, error: msg, code: 'DAEMON_UNAVAILABLE' }), 'DAEMON_UNAVAILABLE');
        }
        else {
            (0, errors_1.printTextAndExit)(msg, true, 'DAEMON_UNAVAILABLE');
        }
        (0, logger_1.log)('warn', 'Connection error', { message: err.message });
    });
});
const parsed = program.parse(process.argv);
const globalOpts = parsed.opts();
if (globalOpts.logLevel)
    (0, logger_1.setLogLevel)(String(globalOpts.logLevel));
if (globalOpts.trace)
    (0, logger_1.setTraceFlags)(String(globalOpts.trace).split(',').map((s) => s.trim()).filter(Boolean));
