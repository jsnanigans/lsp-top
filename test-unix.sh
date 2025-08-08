#!/bin/bash
set -e

echo "Testing Unix-compatible output..."

# Ensure daemon is running
node dist/cli.js daemon restart >/dev/null 2>&1
sleep 2

# Test 1: Check compiler-style output format
echo -n "Test 1: Compiler-style output format... "
output=$(node dist/cli.js check test-project/src/index.ts | head -1)
# Check for pattern: file:line:col: severity code: message
if echo "$output" | grep -qE '^[^:]+:[0-9]+:[0-9]+: (error|warning|hint) TS[0-9]+:'; then
  echo "PASS"
else
  echo "FAIL (expected compiler-style format)"
fi

# Test 2: Grep filtering
echo -n "Test 2: Grep filtering... "
errors=$(node dist/cli.js check test-project/src/index.ts | grep -c error)
if [ "$errors" -eq 2 ]; then
  echo "PASS"
else
  echo "FAIL (expected 2 errors, got $errors)"
fi

# Test 3: Cut and count
echo -n "Test 3: Cut and count... "
error_count=$(node dist/cli.js check test-project/src/index.ts | cut -f4 | grep -c error)
if [ "$error_count" -eq 2 ]; then
  echo "PASS"
else
  echo "FAIL (expected 2, got $error_count)"
fi

# Test 4: JSON output
echo -n "Test 4: JSON output... "
json=$(node dist/cli.js check test-project/src/index.ts --json)
if echo "$json" | jq -e '.schemaVersion == "v1"' > /dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL (invalid JSON structure)"
fi

# Test 5: No decorative output
echo -n "Test 5: No decorative characters... "
output=$(node dist/cli.js check test-project/src/index.ts)
if echo "$output" | grep -E '[📄🔍✅🔴🟡╭╮╰╯]'; then
  echo "FAIL (found decorative characters)"
else
  echo "PASS"
fi

echo "All tests completed!"
