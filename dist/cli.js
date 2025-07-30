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
const path_utils_1 = require("./path-utils");
const typescript_1 = require("./servers/typescript");
const path = __importStar(require("path"));
const program = new commander_1.Command();
const config = new config_1.ConfigManager();
program
    .name('lsp-top')
    .description('LSP server wrapper for running language server commands from anywhere')
    .version('0.1.0');
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
    .action(async (alias, action, args) => {
    const projectPath = config.getPath(alias);
    if (!projectPath) {
        console.error(`Error: Project '${alias}' not found. Use 'lsp-top list' to see available projects.`);
        process.exit(1);
    }
    try {
        const lsp = new typescript_1.TypeScriptLSP(projectPath);
        await lsp.start();
        switch (action) {
            case 'diagnostics': {
                if (!args[0]) {
                    console.error('Error: File path required for diagnostics');
                    process.exit(1);
                }
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, args[0]);
                // console.log(`Getting diagnostics for: ${filePath}`);
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
                const filePath = (0, path_utils_1.resolveProjectPath)(projectPath, fileArg);
                const line = parseInt(lineStr, 10);
                const char = parseInt(charStr, 10);
                if (isNaN(line) || isNaN(char)) {
                    console.error('Error: Invalid position format. Use file.ts:line:column');
                    process.exit(1);
                }
                console.log(`Getting definition at ${filePath}:${line}:${char}`);
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
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
});
program.parse();
