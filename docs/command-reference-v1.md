# LSP-Top Command Reference v1

## Overview

`lsp-top` provides command-line access to Language Server Protocol features, enabling IDE-like functionality from the terminal.

## Command Structure

```
lsp-top [global-options] <command> <subcommand> [options] [arguments]
```

### Global Options
- `-v, --verbose` - Enable verbose logging
- `-q, --quiet` - Suppress non-error output  
- `--json` - Output machine-readable JSON
- `--log-level <level>` - Set log level (error|warn|info|debug|trace)
- `--trace <flags>` - Enable trace flags for debugging

## Core Commands

### 1. Navigate - Code Navigation

#### `navigate def <file:line:col>`
Jump to definition of symbol at position.

```bash
# Go to definition
lsp-top navigate def src/service.ts:10:15

# With JSON output
lsp-top navigate def src/service.ts:10:15 --json
```

Output includes:
- Definition location
- Preview of definition with context
- File path and range

#### `navigate refs <file:line:col> [options]`
Find all references to symbol.

Options:
- `--include-declaration` - Include the declaration
- `--context <n>` - Show n lines of context (default: 2)
- `--limit <n>` - Limit results
- `--group-by-file` - Group results by file

```bash
# Find all references
lsp-top navigate refs src/user.ts:15:10

# With context
lsp-top navigate refs src/user.ts:15:10 --context 3

# Grouped by file
lsp-top navigate refs src/api.ts:20:5 --group-by-file
```

#### `navigate type <file:line:col>`
Jump to type definition.

```bash
# Go to type definition
lsp-top navigate type src/service.ts:25:10
```

#### `navigate impl <file:line:col>`
Find implementations of interface/abstract class.

```bash
# Find implementations
lsp-top navigate impl src/interface.ts:10:5
```

#### `navigate symbol <query> [options]`
Search for symbols by name.

Options:
- `--kind <kind>` - Filter by kind (class|interface|function|variable|etc)
- `--scope <scope>` - Search scope (file|workspace)
- `--exact` - Exact match only
- `--limit <n>` - Limit results

```bash
# Find all classes named User
lsp-top navigate symbol "User" --kind class

# Find symbols in current file
lsp-top navigate symbol "process" --scope file src/service.ts

# Exact match
lsp-top navigate symbol "getUserById" --exact
```

### 2. Explore - Code Understanding

#### `explore hover <file:line:col>`
Show hover information (type, docs, signature).

```bash
# Show hover info
lsp-top explore hover src/api.ts:30:15

# Output:
# ┌─ src/api.ts:30:15 ─────────────────────────────┐
# │ Type: (method) UserService.getUser(id: string) │
# │       → Promise<User>                          │
# │                                                │
# │ Gets a user by their ID.                       │
# │                                                │
# │ @param id - The user's unique identifier       │
# │ @returns Promise resolving to User object      │
# │ @throws UserNotFoundError if user doesn't exist│
# └────────────────────────────────────────────────┘
```

#### `explore symbols <file> [options]`
List symbols in file/workspace.

Options:
- `--tree` - Show as tree structure
- `--kind <kind>` - Filter by symbol kind
- `--sort <by>` - Sort by name|kind|line

```bash
# List all symbols in file
lsp-top explore symbols src/service.ts

# Tree view
lsp-top explore symbols src/service.ts --tree

# Only show classes and interfaces
lsp-top explore symbols src/models.ts --kind class,interface
```

#### `explore signature <file:line:col>`
Show signature help for function calls.

```bash
# Show signature
lsp-top explore signature src/app.ts:45:20
```

#### `explore outline <file>`
Show document outline with all symbols.

```bash
# Show outline
lsp-top explore outline src/service.ts
```

### 3. Analyze - Code Quality

#### `analyze file <file> [options]`
Analyze file for issues.

Options:
- `--severity <level>` - Minimum severity (error|warning|info|hint)
- `--fix-preview` - Show available fixes
- `--fix` - Apply fixes automatically
- `--format` - Include formatting issues

```bash
# Check file
lsp-top analyze file src/service.ts

# Show only errors
lsp-top analyze file src/api.ts --severity error

# Preview fixes
lsp-top analyze file src/utils.ts --fix-preview
```

#### `analyze changed [options]`
Analyze changed files (git).

Options:
- `--staged` - Only staged files
- `--since <ref>` - Changes since git ref
- `--fix` - Apply fixes
- `--summary` - Show summary only

```bash
# Check changed files
lsp-top analyze changed

# Check staged files
lsp-top analyze changed --staged

# Check changes since main
lsp-top analyze changed --since main
```

#### `analyze unused [options]`
Find unused code.

Options:
- `--type <type>` - Type of unused code (exports|variables|imports|all)
- `--ignore <pattern>` - Ignore files matching pattern

```bash
# Find unused exports
lsp-top analyze unused --type exports

# Find all unused code
lsp-top analyze unused --type all
```

### 4. Refactor - Code Transformation

#### `refactor rename <file:line:col> <newName> [options]`
Rename symbol across project.

Options:
- `--preview` - Preview changes without applying
- `--interactive` - Confirm each change

```bash
# Rename symbol
lsp-top refactor rename src/old.ts:10:5 "newName"

# Preview first
lsp-top refactor rename src/api.ts:15:10 "updateUser" --preview
```

#### `refactor extract-function <file:start:end> <name> [options]`
Extract code into function.

Options:
- `--target <location>` - Where to place function
- `--async` - Make function async

```bash
# Extract function
lsp-top refactor extract-function src/long.ts:20:1-30:10 "calculateTotal"

# Extract as async function
lsp-top refactor extract-function src/api.ts:50:5-60:15 "fetchData" --async
```

#### `refactor organize-imports <file>`
Organize and clean up imports.

```bash
# Organize imports
lsp-top refactor organize-imports src/messy.ts

# Multiple files
lsp-top refactor organize-imports src/*.ts
```

#### `refactor format <file> [options]`
Format code.

Options:
- `--check` - Check if formatted, don't modify
- `--config <file>` - Use specific config file

```bash
# Format file
lsp-top refactor format src/ugly.ts

# Check formatting
lsp-top refactor format src/code.ts --check
```

### 5. Edit - Direct Editing

#### `edit apply <file>`
Apply WorkspaceEdit from JSON file.

```bash
# Apply edits
lsp-top edit apply changes.json

# From stdin
cat changes.json | lsp-top edit apply -
```

#### `edit plan <file>`
Create edit plan from changes.

```bash
# Create plan
lsp-top edit plan src/file.ts > plan.json
```

### 6. Project Management

#### `project init <alias> [path]`
Initialize project with alias.

```bash
# Init current directory
lsp-top project init myapp

# Init specific path
lsp-top project init backend /path/to/backend
```

#### `project list`
List all projects.

```bash
lsp-top project list
```

#### `project remove <alias>`
Remove project alias.

```bash
lsp-top project remove myapp
```

### 7. Daemon Management

#### `daemon start`
Start the LSP daemon.

```bash
lsp-top daemon start
```

#### `daemon stop`
Stop the daemon.

```bash
lsp-top daemon stop
```

#### `daemon status`
Check daemon status.

```bash
lsp-top daemon status
```

## Output Formats

### Human-Readable (Default)

```
┌─ src/service.ts:45:10 ─────────────────────────┐
│ 43 │   async processUser(id: string) {         │
│ 44 │     const user = await this.getUser(id);  │
│ 45 │     return user.process();                 │
│    │            ^^^^                           │
│ 46 │   }                                       │
└─────────────────────────────────────────────────┘
  Type: (method) User.process(): Promise<Result>
  Defined at: src/models/user.ts:23:5
```

### JSON Format (--json)

```json
{
  "schemaVersion": "v1",
  "ok": true,
  "command": "navigate.def",
  "data": {
    "location": {
      "uri": "file:///project/src/models/user.ts",
      "range": {
        "start": { "line": 22, "character": 4 },
        "end": { "line": 22, "character": 11 }
      }
    },
    "preview": {
      "lines": [
        { "number": 22, "text": "  async process(): Promise<Result> {" }
      ]
    }
  }
}
```

## Common Workflows

### 1. Understanding New Code

```bash
# What's in this file?
lsp-top explore symbols src/unknown.ts --tree

# What does this function do?
lsp-top explore hover src/api.ts:30:10

# Where is this used?
lsp-top navigate refs src/core.ts:15:5 --limit 10
```

### 2. Refactoring Safely

```bash
# Check what will change
lsp-top refactor rename src/old.ts:10:5 "newName" --preview > changes.json

# Review and apply
lsp-top edit apply changes.json
```

### 3. Code Quality Check

```bash
# Check changed files
lsp-top analyze changed --fix-preview

# Apply fixes
lsp-top analyze changed --fix

# Find unused code
lsp-top analyze unused --type exports
```

### 4. Navigation Flow

```bash
# Find symbol
lsp-top navigate symbol "processUser"

# Go to definition
lsp-top navigate def src/api.ts:30:15

# Find all usages
lsp-top navigate refs src/api.ts:30:15 --group-by-file
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - No result (e.g., symbol not found)
- `3` - Daemon unavailable
- `4` - Invalid arguments

## Performance Tips

1. Keep daemon running for faster responses
2. Use `--limit` for large result sets
3. Use `--json` for scripting
4. Batch operations when possible

## Troubleshooting

### Daemon Issues
```bash
# Check status
lsp-top daemon status

# Restart daemon
lsp-top daemon stop && lsp-top daemon start

# Check logs
lsp-top daemon logs --tail 50
```

### Performance Issues
```bash
# Enable tracing
lsp-top --trace perf navigate def src/slow.ts:10:5

# Check metrics
lsp-top daemon status --json | jq .metrics
```