#!/bin/bash

# Ensure daemon is running
node dist/cli.js daemon restart >/dev/null 2>&1
sleep 2

echo "=== 1. Check (diagnostics) ==="
node dist/cli.js check test-project/src/index.ts | head -2
echo

echo "=== 2. Symbols ==="
node dist/cli.js symbols test-project/src/calculator.ts | head -5
echo

echo "=== 3. Search ==="
node dist/cli.js search Calculator --project test-project | head -3
echo

echo "=== 4. Hover ==="
node dist/cli.js hover test-project/src/calculator.ts:4:14 | head -2
echo

echo "=== 5. Piping example: Count errors by type ==="
node dist/cli.js check test-project/src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c
echo

echo "=== 6. Piping example: Files with errors ==="
node dist/cli.js check test-project/src/index.ts | cut -d: -f1 | sort -u
