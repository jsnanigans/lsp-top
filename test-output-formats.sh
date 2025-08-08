#!/bin/bash

# Quick test to show output format for each command
# Run from lsp-top root directory

set -e

echo "Building and starting daemon..."
pnpm run build >/dev/null 2>&1
node dist/cli.js daemon restart >/dev/null 2>&1
sleep 1

cd test-project

echo "════════════════════════════════════════════════════════════════════════"
echo "LSP-TOP OUTPUT FORMAT EXAMPLES"
echo "════════════════════════════════════════════════════════════════════════"

echo
echo "1. CHECK (diagnostics) - Compiler-style errors"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js check src/index.ts | head -2

echo
echo "2. DEFINITION - Simple location"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js def src/index.ts:9:19

echo
echo "3. REFERENCES - List of locations"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js refs src/calculator.ts:4:14 | head -3

echo
echo "4. SYMBOLS - Hierarchical structure"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js symbols src/calculator.ts

echo
echo "5. SEARCH - Project-wide symbol search"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js search Calculator --project . | head -3

echo
echo "6. HOVER - Type information"
echo "────────────────────────────────────────────────────────────────────────"
node ../dist/cli.js hover src/calculator.ts:10:3

echo
echo "7. PIPING - Count errors by severity"
echo "────────────────────────────────────────────────────────────────────────"
echo "Command: lsp-top check src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c"
node ../dist/cli.js check src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c

echo
echo "8. PIPING - Extract error codes"
echo "────────────────────────────────────────────────────────────────────────"
echo "Command: lsp-top check src/index.ts | grep error | cut -d' ' -f3 | cut -d: -f1"
node ../dist/cli.js check src/index.ts | grep error | cut -d' ' -f3 | cut -d: -f1

echo
echo "9. JSON OUTPUT - Machine readable"
echo "────────────────────────────────────────────────────────────────────────"
echo "Command: lsp-top check src/index.ts --json | jq '.results[0] | {severity, code}'"
node ../dist/cli.js check src/index.ts --json | jq '.results[0] | {severity, code}' 2>/dev/null || echo "(jq not installed)"

echo
echo "════════════════════════════════════════════════════════════════════════"
echo "KEY FEATURES:"
echo "• Consistent file:line:col format across all commands"
echo "• No decorative characters or colors"
echo "• Tab-separated values for piping (with --no-align)"
echo "• JSON output available with --json"
echo "• Compiler-compatible error format"
echo "════════════════════════════════════════════════════════════════════════"