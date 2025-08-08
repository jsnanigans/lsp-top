# lsp-top

Unix-compatible Language Server Protocol CLI for TypeScript code intelligence.

## Features

- **Unix Philosophy**: One line per result, tab-separated fields, pipeable output
- **Fast**: Persistent daemon keeps LSP sessions warm for <100ms responses  
- **Simple**: Flat command structure, no nested subcommands
- **Composable**: Output of any command can be input to another

## Installation

```bash
pnpm install
pnpm run build
```

## Usage

### Basic Commands

```bash
# Go to definition
lsp-top def src/index.ts:10:5

# Find references
lsp-top refs src/api.ts:20:10

# Check for errors
lsp-top check src/index.ts

# List symbols
lsp-top symbols src/calculator.ts

# Search project
lsp-top search "User"
```

### Output Format

Default output is TSV (tab-separated values), one result per line:

```
file	line	column	type	details...
```

Example:
```bash
$ lsp-top check src/index.ts
src/index.ts	14	7	error	TS2741	Property 'email' is missing
src/index.ts	33	14	error	TS2339	Property 'subtract' does not exist
```

### Piping & Composition

```bash
# Count errors by type
lsp-top check src/index.ts | cut -f5 | sort | uniq -c

# Find all errors in project
find . -name "*.ts" | xargs -I {} lsp-top check {} | grep error

# Get definitions for all references
lsp-top refs src/api.ts:20:10 | while IFS=$'\t' read -r file line col type _; do
  lsp-top def "$file:$line:$col"
done

# Count issues by severity
lsp-top check src/index.ts | cut -f4 | sort | uniq -c
```

### JSON Output

Use `--json` for structured output:

```bash
lsp-top check src/index.ts --json | jq '.results[] | select(.type == "error")'
```

## Commands

### Navigation
- `def <position>` - Go to definition
- `refs <position>` - Find references
- `type <position>` - Go to type definition
- `impl <position>` - Find implementations

### Information
- `hover <position>` - Show hover info
- `check <file>` - Check for diagnostics
- `symbols <file>` - List symbols
- `outline <file>` - Show file structure

### Search & Analysis
- `search [query]` - Search project symbols
- `calls <position>` - Show call hierarchy
- `types <position>` - Show type hierarchy

### Refactoring
- `rename <position> <name>` - Rename symbol

### Daemon Management
- `daemon start` - Start daemon
- `daemon stop` - Stop daemon
- `daemon status` - Check status
- `daemon restart` - Restart daemon
- `daemon logs` - View logs

## Position Format

Positions use the standard compiler format:
- `file.ts` - Just the file
- `file.ts:10` - File and line
- `file.ts:10:5` - File, line, and column

## Options

### Global Options
- `--json` - Output JSON instead of TSV
- `-v, --verbose` - Include context lines
- `--delimiter <char>` - Field delimiter (default: tab)
- `--context <n>` - Number of context lines

### Command-Specific Options
- `refs --include-declaration` - Include the declaration
- `symbols --kind <type>` - Filter by symbol kind
- `search --limit <n>` - Limit results
- `calls --direction in|out|both` - Call direction

## Examples

### Find unused exports
```bash
# List all exported symbols
lsp-top symbols src/**/*.ts | grep "export" > exports.txt

# Check each export for references
while IFS=$'\t' read -r file line col type name; do
  refs=$(lsp-top refs "$file:$line:$col" | wc -l)
  if [ "$refs" -eq 0 ]; then
    echo "Unused: $name in $file:$line"
  fi
done < exports.txt
```

### Analyze complexity
```bash
# Count methods per class
lsp-top symbols src/**/*.ts | grep -E "class|method" | \
  awk -F'\t' '/class/{c=$5} /method/{m[c]++} END{for(i in m) print i": "m[i]" methods"}'
```

### Find error hotspots
```bash
# Files with most errors
for file in $(find . -name "*.ts"); do
  errors=$(lsp-top check "$file" | grep -c error)
  [ "$errors" -gt 0 ] && echo "$errors	$file"
done | sort -rn | head -10
```

## Philosophy

This tool follows Unix philosophy:
- Do one thing well
- Output text streams
- Compose with pipes
- Silence is golden
- Simple is better

No decorations, no colors, no progress bars. Just data.

## Performance

The daemon architecture ensures fast responses:
- First request: ~500ms (LSP initialization)
- Subsequent requests: <100ms
- Daemon auto-stops after 5 minutes of inactivity

## Comparison with Traditional LSP Clients

Traditional:
```
🔍 Found 3 references in 2 files
📄 TypeScript • src/calculator.ts
   2 references:
   • Line 4, column 14
   • Line 10, column 8
```

lsp-top:
```
src/calculator.ts	4	14	reference	usage
src/calculator.ts	10	8	reference	usage
```

The difference: lsp-top output can be processed by standard Unix tools.