#!/bin/bash
cd test-project

echo "=== 1. Check (diagnostics) ==="
node ../dist/cli.js check src/index.ts | head -2
echo

echo "=== 2. Symbols ==="
node ../dist/cli.js symbols src/calculator.ts | head -5
echo

echo "=== 3. Search ==="
node ../dist/cli.js search Calculator --project . | head -3
echo

echo "=== 4. Hover ==="
node ../dist/cli.js hover src/calculator.ts:4:14 | head -2
echo

echo "=== 5. Piping example: Count errors by type ==="
node ../dist/cli.js check src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c
echo

echo "=== 6. Piping example: Files with errors ==="
node ../dist/cli.js check src/index.ts | cut -d: -f1 | sort -u
