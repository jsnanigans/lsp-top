#!/bin/bash

# Comprehensive test script for lsp-top
# Tests all commands against test-project files

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print section headers
print_section() {
    echo
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Helper function to print command being run
print_command() {
    echo -e "${YELLOW}$ $1${NC}"
}

# Build the project first
print_section "Building lsp-top"
print_command "pnpm run build"
pnpm run build

# Ensure daemon is running
print_section "Starting daemon"
print_command "node dist/cli.js daemon restart"
node dist/cli.js daemon restart
sleep 2

# Change to test-project for relative paths
cd test-project

# ============================================================================
# NAVIGATION COMMANDS
# ============================================================================

print_section "1. DEFINITION (def) - Go to definition"
print_command "lsp-top def src/index.ts:10:7  # userService variable"
node ../dist/cli.js def src/index.ts:10:7

echo
print_command "lsp-top def src/index.ts:9:19  # Calculator class reference"
node ../dist/cli.js def src/index.ts:9:19

# ============================================================================

print_section "2. REFERENCES (refs) - Find all references"
print_command "lsp-top refs src/types/user.ts:7:18  # User interface"
node ../dist/cli.js refs src/types/user.ts:7:18 | head -5

echo
print_command "lsp-top refs src/calculator.ts:4:14  # Calculator class"
node ../dist/cli.js refs src/calculator.ts:4:14

# ============================================================================

print_section "3. TYPE DEFINITION (type) - Go to type definition"
print_command "lsp-top type src/index.ts:14:7  # user variable type"
node ../dist/cli.js type src/index.ts:14:7

echo
print_command "lsp-top type src/services/user.service.ts:5:3  # users array type"
node ../dist/cli.js type src/services/user.service.ts:5:3

# ============================================================================

print_section "4. IMPLEMENTATION (impl) - Find implementations"
print_command "lsp-top impl src/types/user.ts:7:18  # User interface implementations"
node ../dist/cli.js impl src/types/user.ts:7:18

# ============================================================================
# INFORMATION COMMANDS
# ============================================================================

print_section "5. HOVER - Show type information"
print_command "lsp-top hover src/calculator.ts:4:14  # Calculator class"
node ../dist/cli.js hover src/calculator.ts:4:14

echo
print_command "lsp-top hover src/index.ts:10:7  # userService variable"
node ../dist/cli.js hover src/index.ts:10:7

echo
print_command "lsp-top hover src/calculator.ts:10:3  # add method"
node ../dist/cli.js hover src/calculator.ts:10:3

# ============================================================================
# ANALYSIS COMMANDS
# ============================================================================

print_section "6. CHECK - Get diagnostics for a file"
print_command "lsp-top check src/index.ts"
node ../dist/cli.js check src/index.ts

echo
print_command "lsp-top check src/calculator.ts  # Should have no errors"
node ../dist/cli.js check src/calculator.ts

# ============================================================================
# SYMBOL COMMANDS
# ============================================================================

print_section "7. SYMBOLS - List symbols in a file"
print_command "lsp-top symbols src/calculator.ts"
node ../dist/cli.js symbols src/calculator.ts

echo
print_command "lsp-top symbols src/types/user.ts"
node ../dist/cli.js symbols src/types/user.ts

echo
print_command "lsp-top symbols src/services/user.service.ts | head -10"
node ../dist/cli.js symbols src/services/user.service.ts | head -10

# ============================================================================

print_section "8. OUTLINE - Show file structure"
print_command "lsp-top outline src/services/user.service.ts | head -15"
node ../dist/cli.js outline src/services/user.service.ts | head -15

# ============================================================================

print_section "9. SEARCH - Search symbols in project"
print_command "lsp-top search User --project ."
node ../dist/cli.js search User --project . | head -10

echo
print_command "lsp-top search add --project ."
node ../dist/cli.js search add --project .

echo
print_command "lsp-top search --project . --limit 5  # All symbols, limited"
node ../dist/cli.js search --project . --limit 5

# ============================================================================
# REFACTORING COMMANDS
# ============================================================================

print_section "10. RENAME - Preview rename (dry-run)"
print_command "lsp-top rename src/calculator.ts:10:3 addNumbers --dry-run"
node ../dist/cli.js rename src/calculator.ts:10:3 addNumbers --dry-run || echo "(Preview not implemented yet)"

# ============================================================================
# HIERARCHY COMMANDS
# ============================================================================

print_section "11. CALL HIERARCHY (calls) - Show incoming/outgoing calls"
print_command "lsp-top calls src/calculator.ts:10:3  # add method"
node ../dist/cli.js calls src/calculator.ts:10:3

echo
print_command "lsp-top calls src/services/user.service.ts:35:3 --direction in  # getAllUsers"
node ../dist/cli.js calls src/services/user.service.ts:35:3 --direction in

# ============================================================================

print_section "12. TYPE HIERARCHY (types) - Show type relationships"
print_command "lsp-top types src/types/user.ts:7:18  # User interface"
node ../dist/cli.js types src/types/user.ts:7:18

# ============================================================================
# DAEMON COMMANDS
# ============================================================================

print_section "13. DAEMON - Management commands"
print_command "lsp-top daemon status"
node ../dist/cli.js daemon status

echo
print_command "lsp-top daemon logs --tail 5"
node ../dist/cli.js daemon logs --tail 5

# ============================================================================
# PIPING EXAMPLES
# ============================================================================

print_section "14. UNIX PIPING EXAMPLES"

echo -e "${YELLOW}# Count errors by severity${NC}"
print_command "lsp-top check src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c"
node ../dist/cli.js check src/index.ts | cut -d: -f4 | cut -d' ' -f2 | sort | uniq -c

echo
echo -e "${YELLOW}# Find all TypeScript files with errors${NC}"
print_command "find . -name '*.ts' -exec lsp-top check {} \; 2>/dev/null | cut -d: -f1 | sort -u"
find . -name "*.ts" -type f | head -5 | while read file; do
    node ../dist/cli.js check "$file" 2>/dev/null | cut -d: -f1 | sort -u
done | sort -u

echo
echo -e "${YELLOW}# Count symbols by type${NC}"
print_command "lsp-top symbols src/services/user.service.ts | grep '(' | sed 's/.*(\(.*\)).*/\1/' | sort | uniq -c"
node ../dist/cli.js symbols src/services/user.service.ts | grep '(' | sed 's/.*(\(.*\)).*/\1/' | sort | uniq -c

echo
echo -e "${YELLOW}# Find all classes in project${NC}"
print_command "lsp-top search --project . | grep ': class:' | cut -d: -f1-3"
node ../dist/cli.js search --project . | grep ': class:' | cut -d: -f1-3

# ============================================================================
# JSON OUTPUT EXAMPLES
# ============================================================================

print_section "15. JSON OUTPUT"

echo -e "${YELLOW}# Get diagnostics as JSON${NC}"
print_command "lsp-top check src/index.ts --json | jq '.results[] | {severity, code, message}' | head -20"
node ../dist/cli.js check src/index.ts --json | jq '.results[] | {severity, code, message}' 2>/dev/null | head -20 || echo "(jq not installed)"

echo
echo -e "${YELLOW}# Get symbols as JSON${NC}"
print_command "lsp-top symbols src/calculator.ts --json | jq '.results.symbols[0]' | head -10"
node ../dist/cli.js symbols src/calculator.ts --json | jq '.results.symbols[0]' 2>/dev/null | head -10 || echo "(jq not installed)"

# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================

print_section "16. EDGE CASES"

echo -e "${YELLOW}# Non-existent file${NC}"
print_command "lsp-top check src/nonexistent.ts"
node ../dist/cli.js check src/nonexistent.ts 2>&1 || true

echo
echo -e "${YELLOW}# Invalid position${NC}"
print_command "lsp-top def src/index.ts:999:999"
node ../dist/cli.js def src/index.ts:999:999 || true

echo
echo -e "${YELLOW}# File with no errors${NC}"
print_command "lsp-top check src/utils/helpers.ts"
node ../dist/cli.js check src/utils/helpers.ts

# ============================================================================
# VERBOSE MODE
# ============================================================================

print_section "17. VERBOSE MODE WITH CONTEXT"

print_command "lsp-top def src/index.ts:10:7 -v  # With context lines"
node ../dist/cli.js def src/index.ts:10:7 -v

# ============================================================================
# SUMMARY
# ============================================================================

print_section "TEST COMPLETE"
echo "All commands have been tested. Review the output above for any issues."
echo
echo -e "${GREEN}Key observations:${NC}"
echo "• All commands use consistent file:line:col format"
echo "• Output is pipeable and works with Unix tools"
echo "• JSON output is available with --json flag"
echo "• Daemon manages LSP sessions efficiently"
echo
echo -e "${YELLOW}Daemon status:${NC}"
node ../dist/cli.js daemon status