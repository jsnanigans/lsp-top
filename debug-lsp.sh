#!/bin/bash

# Debug script to test LSP commands with detailed output

echo "Building..."
pnpm run build >/dev/null 2>&1

echo "Restarting daemon..."
node dist/cli.js daemon restart
sleep 2

echo "════════════════════════════════════════════════════════════════════════"
echo "DEBUGGING LSP COMMANDS"
echo "════════════════════════════════════════════════════════════════════════"

echo
echo "1. Testing HOVER on different positions"
echo "────────────────────────────────────────────────────────────────────────"

# Test hover on class name
echo "Position: test-project/src/calculator.ts:4:14 (class Calculator)"
node dist/cli.js hover test-project/src/calculator.ts:4:14
echo "---"

# Test hover on method
echo "Position: test-project/src/calculator.ts:11:3 (add method)"
node dist/cli.js hover test-project/src/calculator.ts:11:3
echo "---"

# Test hover on parameter
echo "Position: test-project/src/calculator.ts:11:11 (parameter a)"
node dist/cli.js hover test-project/src/calculator.ts:11:11
echo "---"

# Test hover on variable
echo "Position: test-project/src/index.ts:9:7 (const calculator)"
node dist/cli.js hover test-project/src/index.ts:9:7
echo "---"

echo
echo "2. Testing DEFINITION on different positions"
echo "────────────────────────────────────────────────────────────────────────"

# Test definition of imported class
echo "Position: test-project/src/index.ts:9:19 (Calculator import)"
node dist/cli.js def test-project/src/index.ts:9:19
echo "---"

# Test definition of UserService import
echo "Position: test-project/src/index.ts:2:10 (UserService import)"
node dist/cli.js def test-project/src/index.ts:2:10
echo "---"

# Test definition of variable
echo "Position: test-project/src/index.ts:10:7 (userService variable)"
node dist/cli.js def test-project/src/index.ts:10:7
echo "---"

# Test definition of method call
echo "Position: test-project/src/index.ts:25:24 (calculator.add call)"
node dist/cli.js def test-project/src/index.ts:25:24
echo "---"

echo
echo "3. Testing REFERENCES"
echo "────────────────────────────────────────────────────────────────────────"

# Test references to Calculator class
echo "Position: test-project/src/calculator.ts:4:14 (Calculator class)"
node dist/cli.js refs test-project/src/calculator.ts:4:14
echo "---"

# Test references to User interface
echo "Position: test-project/src/types/user.ts:7:18 (User interface)"
node dist/cli.js refs test-project/src/types/user.ts:7:18 | head -5
echo "---"

# Test references to add method
echo "Position: test-project/src/calculator.ts:11:3 (add method)"
node dist/cli.js refs test-project/src/calculator.ts:11:3
echo "---"

echo
echo "4. Checking daemon logs for errors"
echo "────────────────────────────────────────────────────────────────────────"
node dist/cli.js daemon logs --tail 10 | grep -E "(error|Error|failed|Failed)" || echo "No errors found in logs"

echo
echo "5. Testing with verbose flag to see timing"
echo "────────────────────────────────────────────────────────────────────────"
echo "Running hover with verbose..."
node dist/cli.js hover test-project/src/calculator.ts:4:14 -v

echo
echo "6. Testing JSON output to see raw data"
echo "────────────────────────────────────────────────────────────────────────"
echo "Hover as JSON:"
node dist/cli.js hover test-project/src/calculator.ts:4:14 --json | jq '.'

echo
echo "Definition as JSON:"
node dist/cli.js def test-project/src/index.ts:9:19 --json | jq '.'

echo
echo "References as JSON:"
node dist/cli.js refs test-project/src/calculator.ts:4:14 --json | jq '.'