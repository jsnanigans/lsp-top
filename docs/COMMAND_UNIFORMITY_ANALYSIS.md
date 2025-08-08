# Command Uniformity Analysis & Unix Philosophy Alignment

## Current State Analysis

### Command Structure Inconsistencies

#### 1. **Input Parameter Formats**
Currently, we have multiple inconsistent input formats:

- **Position-based**: `<file:line:col>` (navigate, explore hover, refactor rename)
- **File-only**: `<file>` (explore symbols, analyze file, refactor organize-imports)
- **Optional query**: `[query]` (explore project-symbols)
- **Mixed positional/flags**: Various combinations across commands

**Problems:**
- No consistent delimiter (`:` vs space vs flags)
- Position format not universally applicable
- Inconsistent optional vs required parameters

#### 2. **Output Format Inconsistencies**

**Human-Readable Output Issues:**
- Heavy use of Unicode box drawing (╭─╮) - not pipe-friendly
- Emoji prefixes (📄, 🔍, ✅) - decorative but not parseable
- Multi-line formatted blocks - hard to grep/sed/awk
- Inconsistent field separators
- No standard line-based format for piping

**JSON Output Issues:**
- Wrapped with `schemaVersion` at top level
- Different structures for similar data types
- Some commands return arrays, others objects
- Timing data mixed with results
- No consistent error format

### Unix Philosophy Violations

1. **Do One Thing Well**: Commands like `analyze` do multiple things
2. **Text Streams**: Current output is presentation-focused, not stream-friendly
3. **Composability**: Can't easily pipe between commands
4. **Silence is Golden**: Too much decorative output
5. **Standard Formats**: No consistent delimiter/format

## Proposed Uniform Design

### Design Principles (Unix Philosophy)

1. **One Line Per Result** - Each result occupies exactly one line
2. **Tab-Separated Fields** - Consistent field delimiter (configurable)
3. **No Decoration** - No emojis, boxes, or Unicode art
4. **Silence is Golden** - Only output data, no progress messages
5. **Pipeable by Default** - Output of any command can be input to another
6. **Standard Error Conventions** - Errors to stderr, data to stdout
7. **Predictable Structure** - Same field order across all commands

### Proposed Uniform Input Format

```bash
# All position-based commands use the same format
lsp-top <command> [<file>][:<line>][:<col>] [options]

# Examples:
lsp-top def src/foo.ts:10:5          # specific position
lsp-top refs src/foo.ts:10           # line only (col defaults to 1)
lsp-top symbols src/foo.ts           # file only
lsp-top diagnostics src/foo.ts       # file only
lsp-top hover -                      # read from stdin
```

### Proposed Uniform Output Format

#### Default Output (Unix-style, pipeable)

```bash
# One result per line, tab-separated fields
# Format: <file>\t<line>\t<col>\t<type>\t<details>

# Definition
$ lsp-top def src/foo.ts:10:5
src/types/user.ts	5	14	definition	interface User

# References (multiple lines)
$ lsp-top refs src/foo.ts:10:5
src/index.ts	10	5	reference	import
src/service.ts	23	15	reference	parameter
src/service.ts	45	8	reference	return

# Diagnostics
$ lsp-top diagnostics src/foo.ts
src/foo.ts	10	5	error	TS2322	Type 'string' is not assignable to type 'number'
src/foo.ts	23	1	warning	TS6133	'x' is declared but never used

# Symbols
$ lsp-top symbols src/foo.ts
src/foo.ts	5	0	class	User
src/foo.ts	6	2	method	constructor
src/foo.ts	10	2	property	name
src/foo.ts	15	0	function	processUser
```

#### Verbose Output (`-v` flag)
```bash
# Add context lines with prefix
$ lsp-top def src/foo.ts:10:5 -v
src/types/user.ts	5	14	definition	interface User
  3 | import { BaseModel } from './base';
  4 |
> 5 | export interface User extends BaseModel {
  6 |   name: string;
  7 |   email: string;
```

#### JSON Output (`--json` flag)
```json
{
  "command": "definition",
  "results": [
    {
      "file": "src/types/user.ts",
      "line": 5,
      "column": 14,
      "type": "definition",
      "kind": "interface",
      "name": "User",
      "uri": "file:///path/to/src/types/user.ts"
    }
  ],
  "timing": {
    "total": 45,
    "lsp": 40
  }
}
```

### Command Chaining & Piping

```bash
# Find all references and get their definitions
lsp-top refs src/user.ts:10:5 | cut -f1-3 | xargs -I {} lsp-top def {}

# Get all errors in changed files
git diff --name-only | xargs -I {} lsp-top diagnostics {} | grep "^.*\terror\t"

# Find all classes in project
lsp-top symbols --project . | grep "\tclass\t"

# Count references by file
lsp-top refs src/api.ts:20:10 | cut -f1 | sort | uniq -c

# Get hover info for all symbols in a file
lsp-top symbols src/foo.ts | while IFS=$'\t' read -r file line col type name; do
  echo "$name:"
  lsp-top hover "$file:$line:$col" | head -1
done
```

### Standardized Options

```bash
# Global options (all commands)
--json              # JSON output
--format <fmt>      # Output format: tsv (default), csv, json, compact
--delimiter <char>  # Field delimiter (default: tab)
--no-headers        # Omit headers in csv/tsv
-v, --verbose       # Include context
-q, --quiet         # Errors only
--stdin             # Read input from stdin

# Filtering options (where applicable)
--type <type>       # Filter by type/kind
--severity <level>  # Filter by severity
--limit <n>         # Limit results
--project <path>    # Project scope

# Context options
--context <n>       # Context lines (default: 0, -v sets to 3)
--group             # Group results by file
```

### Command Simplification

#### Current vs Proposed

```bash
# CURRENT (complex, nested structure)
lsp-top navigate def src/foo.ts:10:5
lsp-top explore hover src/foo.ts:10:5
lsp-top analyze file src/foo.ts
lsp-top refactor rename src/foo.ts:10:5 NewName --preview

# PROPOSED (flat, simple)
lsp-top def src/foo.ts:10:5
lsp-top hover src/foo.ts:10:5
lsp-top check src/foo.ts
lsp-top rename src/foo.ts:10:5 NewName --dry-run
```

### Error Handling

```bash
# Consistent error format (stderr)
<program>: <error-type>: <message>
lsp-top: error: no definition found at src/foo.ts:10:5
lsp-top: warning: multiple definitions found, showing first

# Exit codes
0   - Success
1   - Command error (bad arguments)
2   - LSP error (server issue)
3   - Not found (no results)
4   - Partial success (some operations failed)
```

### Refactoring Plan

#### Step 1: New Output System
Create a new output system that replaces the current formatter:

```typescript
// src/unix-formatter.ts
interface OutputOptions {
  format: 'tsv' | 'csv' | 'json' | 'compact';
  delimiter?: string;
  headers?: boolean;
  verbose?: boolean;
}

function formatResult(type: string, data: any, options: OutputOptions): string {
  // TSV by default, one line per result
  // No decorations, no emojis, just data
}
```

#### Step 2: Simplified Command Structure
Replace nested command groups with flat structure:

```typescript
// Before: program.command('navigate').command('def')
// After: program.command('def')

// All commands at root level
program.command('def <position>')
program.command('refs <position>')
program.command('hover <position>')
program.command('check <file>')
program.command('symbols <file>')
```

#### Step 3: Uniform Input Handling
Single position parser for all commands:

```typescript
// src/position-parser.ts
interface Position {
  file: string;
  line?: number;
  column?: number;
}

function parsePosition(input: string): Position {
  // Handle: file.ts, file.ts:10, file.ts:10:5
  // Also handle stdin: -
}
```

#### Step 4: Consistent Options
Global options applied uniformly:

```typescript
// Applied to all commands
.option('--format <type>', 'Output format', 'tsv')
.option('--no-headers', 'Omit headers')
.option('-v, --verbose', 'Include context')
.option('-q, --quiet', 'Suppress output')
```

### Example New Commands

```bash
# Core navigation
lsp-top def <pos>          # go to definition
lsp-top refs <pos>         # find references
lsp-top type <pos>         # type definition
lsp-top impl <pos>         # implementations

# Information
lsp-top hover <pos>        # hover info
lsp-top sig <pos>          # signature help
lsp-top doc <pos>          # documentation

# Analysis
lsp-top check <file>       # diagnostics/lint
lsp-top symbols <file>     # list symbols
lsp-top outline <file>     # tree view

# Refactoring
lsp-top rename <pos> <new> # rename symbol
lsp-top format <file>      # format code
lsp-top fix <file>         # apply fixes

# Project-wide
lsp-top search <query>     # search symbols
lsp-top errors             # all errors in project
lsp-top todos              # find TODO/FIXME
```

### Benefits

1. **Composability**: Every command output can be input to another
2. **Scriptability**: Easy to use in shell scripts
3. **Familiarity**: Follows Unix conventions
4. **Performance**: Less formatting overhead
5. **Flexibility**: Users choose their formatting
6. **Debugging**: Simple to test and debug

## Implementation Approach

Since this tool has never been released, we can freely redesign all commands without compatibility concerns. This is a complete refactor, not a migration.

### Immediate Changes

1. **Replace all decorative output** - Remove emojis, box drawing, colored output
2. **Flatten command structure** - Remove nested command groups
3. **Standardize all I/O** - One format for positions, one format for output
4. **Simplify option names** - Use common Unix conventions

### Core Principles

- **No backwards compatibility needed** - Fresh start
- **No versioning concerns** - Always 1.0.0
- **No deprecation warnings** - Just replace
- **No legacy modes** - One way to do things

## Concrete Examples: Before & After

### Finding References

**BEFORE:**
```bash
$ lsp-top navigate refs src/calculator.ts:4:14
🔍 Found 3 references in 2 files
   TypeScript files

📄 TypeScript • src/calculator.ts
   2 references:
   • Line 4, column 14
   • Line 10, column 8

📄 TypeScript • src/index.ts
   1 reference:
   • Line 15, column 12
```

**AFTER:**
```bash
$ lsp-top refs src/calculator.ts:4:14
src/calculator.ts	4	14	reference	declaration
src/calculator.ts	10	8	reference	usage
src/index.ts	15	12	reference	import
```

### Getting Diagnostics

**BEFORE:**
```bash
$ lsp-top analyze file src/index.ts
📋 Diagnostics Report
   TypeScript • src/index.ts
   ──────────────────────────────────────────────────

📊 Summary: 2 errors, 1 warning

🔴 ERRORS (2)
   Line 14:7
   └─ Property 'email' is missing [TS2741]

   Line 33:14
   └─ Property 'subtract' does not exist [TS2339]

🟡 WARNINGS (1)
   Line 7:1
   └─ 'unusedFunction' is declared but never used [TS6133]
```

**AFTER:**
```bash
$ lsp-top check src/index.ts
src/index.ts	14	7	error	TS2741	Property 'email' is missing
src/index.ts	33	14	error	TS2339	Property 'subtract' does not exist
src/index.ts	7	1	warning	TS6133	'unusedFunction' is declared but never used
```

### Command Chaining Examples

**Find all errors in changed files:**
```bash
git diff --name-only | xargs -I {} lsp-top check {} | grep "error"
```

**Get definitions for all references:**
```bash
lsp-top refs src/api.ts:20:10 | while IFS=$'\t' read -r file line col type _; do
  lsp-top def "$file:$line:$col"
done
```

**Count issues by severity:**
```bash
lsp-top check --project . | cut -f4 | sort | uniq -c
```

**Find all exported functions:**
```bash
lsp-top symbols --project . | grep "function" | grep "export"
```

## Next Steps

1. Create `src/unix-formatter.ts` with TSV/CSV/JSON output
2. Create `src/position-parser.ts` for uniform input handling
3. Refactor `src/cli.ts` to flatten command structure
4. Update `src/output-formatter.ts` to use new formatter
5. Add stdin support (`-` convention) to all commands
6. Update all tests for new output format
7. Remove all emoji and box-drawing characters
8. Standardize error output to stderr