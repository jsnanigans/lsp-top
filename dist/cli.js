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
    .version('0.1.0');
program
    .command('start-server')
    .description('Start the LSP daemon')
    .option('-v, --verbose', 'Enable verbose logging')
    .action((options) => {
    const args = options.verbose ? ['--verbose'] : [];
    const daemon = (0, child_process_1.spawn)(process.argv[0], [path.resolve(__dirname, 'daemon.js'), ...args], {
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
    }
    else {
        console.log('Log file not found.');
    }
});
program
    .command('init <alias> [path]')
    .description('Initialize a project with an alias')
    .action((alias, projectPath) => {
    try {
        const pathToUse = projectPath || process.cwd();
        config.addAlias(alias, pathToUse);
        console.log(`✓ Initialized project '${alias}' at ${path.resolve(pathToUse)}`);
    }
    catch (error) {
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
    .action((alias) => {
    if (config.removeAlias(alias)) {
        console.log(`✓ Removed project '${alias}'`);
    }
    else {
        console.error(`Error: Project '${alias}' not found`);
        process.exit(1);
    }
});
program
    .command('run <alias> <action> [args...]')
    .description('Run an LSP action for a project')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (alias, action, args, options) => {
    (0, logger_1.setVerbose)(options.verbose);
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
                    }
                    else if (response.type === 'result') {
                        console.log(JSON.stringify(response.data, null, 2));
                    }
                    else if (response.type === 'error') {
                        console.error('Error:', response.message);
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
        console.error('Failed to connect to daemon. Is it running?');
        (0, logger_1.log)('Connection error:', err.message);
        process.exit(1);
    });
});
program.parse(process.argv);
