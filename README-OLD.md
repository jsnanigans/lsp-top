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
- **🛠️ Code analysis** - Get diagnostics, analyze changed files or entire projects
- **♻️ Code refactoring** - Rename symbols, organize imports
- **🌍 Project-wide operations** - Search symbols, analyze entire codebases
- **📞 Call & type hierarchies** - Understand code relationships and inheritance

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

# Search symbols across entire project
lsp-top explore project-symbols [query] [--project <path>] [--limit <n>]

# Show call hierarchy (incoming/outgoing calls)
lsp-top explore call-hierarchy <file:line:col> [--direction <in|out|both>]

# Show type hierarchy (supertypes/subtypes)
lsp-top explore type-hierarchy <file:line:col> [--direction <super|sub|both>]
```

### 📊 Analyze - Code Analysis

Analyze code for issues and improvements.

```bash
# Get diagnostics for a file
lsp-top analyze file <file> [--fix]

# Analyze changed files (git)
lsp-top analyze changed [--staged] [--fix]

# Analyze entire project
lsp-top analyze project [--project <path>] [--severity <level>] [--summary]
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

### Search symbols across entire project

```bash
# Find all classes in project
lsp-top explore project-symbols --kind class

# Search for "user" related symbols
lsp-top explore project-symbols user

# Analyze a different project
lsp-top explore project-symbols --project ~/other-app
```

### Analyze entire project

```bash
# Get error summary
lsp-top analyze project --summary

# Include warnings
lsp-top analyze project --severity warning

# Analyze specific project
lsp-top analyze project --project ../my-lib --summary
```

### Explore call hierarchies

```bash
# Who calls this function?
lsp-top explore call-hierarchy src/api.ts:25:10 --direction in

# What does this function call?
lsp-top explore call-hierarchy src/api.ts:25:10 --direction out
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

## Project Discovery

LSP-Top automatically discovers TypeScript projects by finding the nearest `tsconfig.json`. 

### How It Works

1. **For file-specific commands**: Walks up from the file to find the nearest `tsconfig.json`
2. **For project-wide commands**: Uses current directory or `--project` option
3. **Shows project root**: All project commands display which project they're analyzing

### Specifying Projects

```bash
# Use current directory (default)
lsp-top analyze project

# Specify project by directory
lsp-top analyze project --project ~/my-app

# Specify project by any file within it
lsp-top explore project-symbols --project src/index.ts

# Use relative paths
lsp-top analyze project --project ../other-project

# Work from anywhere
cd /anywhere
lsp-top analyze project --project /path/to/project
```

### Monorepo Support

In monorepos with multiple `tsconfig.json` files, LSP-Top uses the nearest one:

```
monorepo/
├── packages/
│   ├── app/          # Has tsconfig.json
│   └── lib/          # Has tsconfig.json
└── tsconfig.json     # Root config
```

```bash
cd packages/app
lsp-top analyze project  # Analyzes only 'app' package

cd ../..
lsp-top analyze project  # Analyzes entire monorepo
```

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