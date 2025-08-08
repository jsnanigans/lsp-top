# LSP-Top

> Language Server Protocol CLI for code intelligence - "grep for code understanding"

LSP-Top brings IDE-level code intelligence to your terminal. Navigate, explore, analyze, and refactor TypeScript codebases with lightning-fast responses and beautiful, contextual output.

## Features

- **⚡ Sub-100ms responses** - Persistent daemon keeps LSP sessions warm
- **🎯 Hierarchical commands** - Intuitive command groups for easy discovery
- **📝 Human-readable output** - Beautiful formatted output with syntax context
- **🔒 Safe refactoring** - Required `--preview`/`--write` flags for dangerous operations
- **📊 JSON output** - Machine-readable output with schema versioning
- **🔍 Code navigation** - Jump to definitions, find references, explore types
- **🛠️ Code analysis** - Get diagnostics, analyze changed files
- **♻️ Code refactoring** - Rename symbols, organize imports

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lsp-top.git
cd lsp-top

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link globally (optional)
npm link
```

## Quick Start

```bash
# Navigate to definition
lsp-top navigate def src/file.ts:10:5

# Find all references
lsp-top navigate refs src/file.ts:10:5

# Get type information
lsp-top explore hover src/file.ts:10:5

# Analyze file for issues
lsp-top analyze file src/file.ts

# Preview rename operation
lsp-top refactor rename src/file.ts:10:5 NewName --preview
```

## Command Structure

LSP-Top uses a hierarchical command structure with 5 main command groups:

### 🧭 Navigate - Code Navigation

Navigate through code relationships and definitions.

```bash
# Go to definition
lsp-top navigate def <file:line:col>

# Find references
lsp-top navigate refs <file:line:col> [--include-declaration]

# Go to type definition
lsp-top navigate type <file:line:col>

# Find implementations
lsp-top navigate impl <file:line:col>
```

### 🔍 Explore - Code Exploration

Explore code structure and information.

```bash
# Show hover information (type and docs)
lsp-top explore hover <file:line:col>

# List document symbols
lsp-top explore symbols <file> [--query <filter>]

# Show file outline (tree view)
lsp-top explore outline <file>
```

### 📊 Analyze - Code Analysis

Analyze code for issues and improvements.

```bash
# Get diagnostics for a file
lsp-top analyze file <file> [--fix]

# Analyze changed files (git)
lsp-top analyze changed [--staged] [--fix]
```

### ♻️ Refactor - Code Refactoring

Safely refactor code with preview and write controls.

```bash
# Rename symbol across project
lsp-top refactor rename <file:line:col> <newName> --preview
lsp-top refactor rename <file:line:col> <newName> --write

# Organize imports
lsp-top refactor organize-imports <file> --preview
lsp-top refactor organize-imports <file> --write
```

### 🔧 Daemon - Daemon Management

Manage the LSP daemon lifecycle.

```bash
# Start daemon (usually automatic)
lsp-top daemon start

# Stop daemon
lsp-top daemon stop

# Check status
lsp-top daemon status

# View logs
lsp-top daemon logs [--tail <n>] [--follow]
```

## Output Formats

### Human-Readable (Default)

Beautiful, contextual output with syntax highlighting:

```
src/calculator.ts:4:1
┌─────────────────────────────────────────────────┐
│    1 │ /**
│    2 │  * A simple calculator class
│    3 │  */
│ >  4 │ export class Calculator {
│    5 │   /**
│    6 │    * Adds two numbers together
│    7 │    * @param a First number
└─────────────────────────────────────────────────┘
```

### JSON Output

Machine-readable output with schema versioning:

```bash
lsp-top navigate def src/file.ts:10:5 --json
```

```json
{
  "schemaVersion": "2.0.0",
  "ok": true,
  "data": {
    "uri": "file:///path/to/definition.ts",
    "range": {
      "start": { "line": 3, "character": 0 },
      "end": { "line": 39, "character": 1 }
    },
    "timing": 1
  }
}
```

## Global Options

```bash
-v, --verbose        Enable verbose logging
-q, --quiet          Suppress non-error output
--json               Output machine-readable JSON
--log-level <level>  Set log level (error|warn|info|debug|trace)
--trace <flags>      Comma-separated trace flags
--preview            Preview changes without applying
--write              Apply changes to disk
```

## Context Options

Many commands support additional context options:

```bash
--context <lines>    Number of context lines to show (default: 3)
--group-by-file      Group results by file
--limit <n>          Limit number of results
```

## Examples

### Find all references with context

```bash
lsp-top navigate refs src/user.ts:15:10 --context 5 --group-by-file
```

### Analyze changed files and show fixes

```bash
lsp-top analyze changed --staged --fix
```

### Preview rename operation

```bash
lsp-top refactor rename src/api.ts:20:5 UserService --preview
```

### Get JSON output for automation

```bash
lsp-top navigate def src/main.ts:10:5 --json | jq '.data.uri'
```

## Performance

LSP-Top achieves sub-100ms response times through:

- **Persistent daemon** - Keeps LSP sessions warm
- **Smart caching** - Reuses open documents
- **Efficient protocol** - Unix socket communication
- **Lazy loading** - Only processes what's needed

Typical response times:
- Navigation commands: ~1ms
- Analysis commands: ~5-10ms
- Refactoring preview: ~10-20ms

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     CLI     │────▶│   Daemon    │────▶│ LSP Client  │
│ (commander) │     │(Unix Socket)│     │ (TypeScript)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                                         │
       ▼                                         ▼
┌─────────────┐                         ┌─────────────┐
│  Formatter  │                         │   Language  │
│   (Human)   │                         │   Server    │
└─────────────┘                         └─────────────┘
```

## Configuration

LSP-Top automatically discovers TypeScript projects by finding the nearest `tsconfig.json`. No manual configuration required!

## Troubleshooting

### Daemon Issues

```bash
# Check if daemon is running
lsp-top daemon status

# View daemon logs
lsp-top daemon logs --tail 50

# Force restart
lsp-top daemon stop && lsp-top daemon start
```

### Performance Issues

```bash
# Enable verbose logging
lsp-top navigate def src/file.ts:10:5 --verbose

# Check timing in JSON output
lsp-top navigate def src/file.ts:10:5 --json | jq '.data.timing'
```

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run in development mode
pnpm run dev -- navigate def src/file.ts:10:5

# Run tests
pnpm test

# Type checking
pnpm run typecheck
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## License

MIT

## Acknowledgments

Built with:
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [Commander.js](https://github.com/tj/commander.js)
- Node.js LSP libraries

---

**LSP-Top** - Bringing IDE intelligence to your terminal 🚀