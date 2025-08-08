#!/usr/bin/env node

/**
 * Migration wrapper for old CLI commands to new v2 structure
 * This provides backward compatibility during the transition period
 */

import { spawn } from "child_process";
import * as path from "path";

const oldToNew: { [key: string]: string[] } = {
  definition: ["navigate", "def"],
  def: ["navigate", "def"],
  references: ["navigate", "refs"],
  refs: ["navigate", "refs"],
  hover: ["explore", "hover"],
  symbols: ["explore", "symbols"],
  diagnostics: ["analyze", "file"],
  inspect: ["analyze", "file"],
  "inspect-changed": ["analyze", "changed"],
  "stop-daemon": ["daemon", "stop"],
  "daemon-status": ["daemon", "status"],
  logs: ["daemon", "logs"],
};

function showMigrationMessage(oldCmd: string, newCmd: string[]): void {
  console.error(`\n⚠️  Command syntax has changed in v2.0.0`);
  console.error(`   Old: lsp-top ${oldCmd} <args>`);
  console.error(`   New: lsp-top ${newCmd.join(" ")} <args>`);
  console.error(`\nAutomatically redirecting to new command...\n`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No command, just run the new CLI
    const cli = spawn(process.argv[0], [path.resolve(__dirname, "cli-v2.js")], {
      stdio: "inherit",
    });
    cli.on("exit", (code) => process.exit(code || 0));
    return;
  }

  const command = args[0];

  // Check if this is an old command
  if (oldToNew[command]) {
    const newCmd = oldToNew[command];
    showMigrationMessage(command, newCmd);

    // Build new arguments
    const newArgs = [...newCmd, ...args.slice(1)];

    // Run the new CLI with migrated command
    const cli = spawn(
      process.argv[0],
      [path.resolve(__dirname, "cli-v2.js"), ...newArgs],
      { stdio: "inherit" },
    );
    cli.on("exit", (code) => process.exit(code || 0));
  } else {
    // Not an old command, pass through to new CLI
    const cli = spawn(
      process.argv[0],
      [path.resolve(__dirname, "cli-v2.js"), ...args],
      { stdio: "inherit" },
    );
    cli.on("exit", (code) => process.exit(code || 0));
  }
}

main();
