#!/bin/bash
set -e

echo "Testing Unix-compatible output..."

# Test 1: Check TSV output
echo -n "Test 1: TSV output format... "
output=$(cd test-project && node ../dist/cli.js check src/index.ts | head -1)
fields=$(echo "$output" | awk -F'\t' '{print NF}')
if [ "$fields" -ge 5 ]; then
  echo "PASS"
else
  echo "FAIL (expected at least 5 fields, got $fields)"
fi

# Test 2: Grep filtering
echo -n "Test 2: Grep filtering... "
errors=$(cd test-project && node ../dist/cli.js check src/index.ts | grep -c error)
if [ "$errors" -eq 2 ]; then
  echo "PASS"
else
  echo "FAIL (expected 2 errors, got $errors)"
fi

# Test 3: Cut and count
echo -n "Test 3: Cut and count... "
error_count=$(cd test-project && node ../dist/cli.js check src/index.ts | cut -f4 | grep -c error)
if [ "$error_count" -eq 2 ]; then
  echo "PASS"
else
  echo "FAIL (expected 2, got $error_count)"
fi

# Test 4: JSON output
echo -n "Test 4: JSON output... "
json=$(cd test-project && node ../dist/cli.js check src/index.ts --json)
if echo "$json" | jq -e '.command == "diagnostics"' > /dev/null; then
  echo "PASS"
else
  echo "FAIL (invalid JSON structure)"
fi

# Test 5: No decorative output
echo -n "Test 5: No decorative characters... "
output=$(cd test-project && node ../dist/cli.js check src/index.ts)
if echo "$output" | grep -E '[📄🔍✅🔴🟡╭╮╰╯]'; then
  echo "FAIL (found decorative characters)"
else
  echo "PASS"
fi

echo "All tests completed!"
