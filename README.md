# LSP-Top

A powerful command-line IDE that brings Language Server Protocol features to your terminal. Navigate, understand, and refactor TypeScript codebases without ever opening a traditional editor.

## Why LSP-Top?

Imagine working purely from the command line - SSH'd into a remote server, using only terminal tools, or building AI agents that need to understand code. LSP-Top gives you IDE-level code intelligence through simple, composable commands.

## Key Features

- **🔍 Smart Navigation**: Jump to definitions, find references, explore implementations
- **📖 Code Understanding**: Get hover information, signatures, and documentation
- **🔧 Safe Refactoring**: Rename symbols, extract functions, organize imports
- **📊 Code Analysis**: Find issues, unused code, and complexity metrics
- **🤖 AI-Friendly**: Structured JSON output for automation
- **⚡ Fast**: Persistent daemon with intelligent caching (<100ms responses)
- **🎯 Context-Aware**: Shows surrounding code, not just line numbers

## Installation

```bash
pnpm install
pnpm run build
npm link
```

Requirements: 
- Node.js 18+
- TypeScript projects need `@vtsls/language-server`:
  ```bash
  pnpm add -D @vtsls/language-server
  ```

## Quick Start

```bash
# 1) Initialize a project
lsp-top init myapp ~/projects/myapp

# 2) Start the daemon (optional, for faster responses)
lsp-top start-server

# 3) Navigate code - find definitions
lsp-top run myapp definition src/index.ts:10:5

# 4) Find all references
lsp-top run myapp references src/index.ts:10:5

# 5) Check for type errors
lsp-top run myapp diagnostics src/service.ts

# 6) Inspect files for issues
lsp-top inspect myapp file src/service.ts
```

## Command Reference

### Global Options
- `-v, --verbose` - Enable verbose logging
- `-q, --quiet` - Suppress non-error output
- `--json` - Output machine-readable JSON
- `--log-level <level>` - Set log level (error|warn|info|debug|trace)
- `--trace <flags>` - Enable trace flags for debugging

### Project Management
```bash
lsp-top init <alias> [path]          # Initialize project with alias
lsp-top list                         # List all projects (⚠️ has display bug)
lsp-top remove <alias>               # Remove project alias
lsp-top configure --set-alias <alias:path>  # Set alias
lsp-top configure --print            # Show configuration (use this to see projects)
```

### Code Inspection
```bash
# Check single file
lsp-top inspect <alias> file <path> [options]
  --fix                    # Apply available fixes (⚠️ not generating fixes currently)
  --fix-dry               # Preview fixes without applying
  --organize-imports      # Organize import statements (not implemented)
  --format                # Format code (not implemented)
  --write                 # Write changes to disk

# Check changed files (git)
lsp-top inspect <alias> changed [options]
  --staged                # Only staged files
  --fix                   # Apply fixes to all files

# Examples
lsp-top inspect myapp file src/service.ts
lsp-top inspect myapp changed --staged
```

### Code Navigation (Working)
```bash
lsp-top run <alias> definition <file:line:col>
lsp-top run <alias> references <file:line:col> [--include-declaration]
lsp-top run <alias> diagnostics <file>

# Examples
lsp-top run myapp definition src/api.ts:30:15
lsp-top run myapp references src/user.ts:10:5 --include-declaration
lsp-top run myapp diagnostics src/service.ts

# JSON output for scripting
lsp-top run myapp definition src/api.ts:30:15 --json
```

### Code Editing
```bash
lsp-top edit <alias> apply <file>    # Apply WorkspaceEdit JSON
lsp-top edit <alias> plan <file>     # Create edit plan
```

### Daemon Management
```bash
lsp-top start-server                 # Start background daemon
lsp-top metrics [--json]             # Show daemon status
lsp-top logs [--tail <n>] [--follow] # View daemon logs
```

### Diagnostics
```bash
lsp-top diagnose [alias]             # Check environment setup
```

## Coming in v1.0

### 🚀 Navigation Commands
```bash
lsp-top navigate def src/api.ts:30:15         # Go to definition
lsp-top navigate refs src/user.ts:10:5        # Find all references
lsp-top navigate type src/api.ts:30:15        # Go to type definition
lsp-top navigate impl src/interface.ts:5:10   # Find implementations
lsp-top navigate symbol "UserService"         # Search symbols by name
```

### 📚 Code Understanding
```bash
lsp-top explore hover src/api.ts:30:15        # Show type info & docs
lsp-top explore signature src/call.ts:20:10   # Show function signature
lsp-top explore symbols src/module.ts --tree  # Show file symbols
lsp-top explore outline src/service.ts        # Document outline
```

### 🔨 Refactoring
```bash
lsp-top refactor rename src/old.ts:10:5 "newName" --preview
lsp-top refactor extract-function src/long.ts:20-30 "helper"
lsp-top refactor organize-imports src/messy.ts
```

### 🔍 Search & Analysis
```bash
lsp-top search text "TODO" --glob "**/*.ts"
lsp-top search symbol "process" --kind function
lsp-top analyze unused --type exports
lsp-top analyze complexity src/complex.ts
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
  "data": {
    "location": {
      "uri": "file:///project/src/models/user.ts",
      "range": {
        "start": { "line": 22, "character": 4 },
        "end": { "line": 22, "character": 11 }
      }
    }
  }
}
```

## Use Cases

### For Human Developers
```bash
# Working over SSH
ssh remote-server
lsp-top navigate def src/api.ts:30:15
lsp-top explore hover src/complex.ts:45:20

# Quick code verification
lsp-top analyze file src/new-feature.ts --fix
lsp-top analyze changed --staged

# Exploring unknown codebase
lsp-top explore symbols src/core.ts --tree
lsp-top navigate refs src/main.ts:bootstrap:10:5
```

### For AI Agents
```python
# Analyze codebase
result = run_command("lsp-top analyze file src/service.ts --json")
diagnostics = json.loads(result)["data"]["diagnostics"]

# Navigate code relationships
refs = run_command("lsp-top navigate refs src/api.ts:30:15 --json")
locations = json.loads(refs)["data"]["locations"]

# Safe refactoring
preview = run_command('lsp-top refactor rename src/old.ts:10:5 "new" --preview --json')
if len(preview["data"]["changes"]) < 10:
    run_command('lsp-top refactor rename src/old.ts:10:5 "new"')
```

## Configuration

- Project aliases stored in `~/.config/lsp-top/config.json`
- Daemon socket at `/tmp/lsp-top.sock`
- Logs at `/tmp/lsp-top.log`

## Development

```bash
# Build the project
pnpm run build

# Run in development mode (⚠️ has ES module issues, use built version instead)
# pnpm run dev -- <command>  # Currently broken
node dist/cli.js <command>   # Use this instead

# Run tests
pnpm test

# Type check
pnpm run typecheck
```

## Documentation

See the [docs](./docs) directory for:
- [Design Document](./docs/DESIGN.md) - Architecture and command structure
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Development roadmap
- [Command Reference](./docs/command-reference-v1.md) - Detailed command documentation
- [Use Cases](./docs/use-cases.md) - Real-world examples

## Roadmap

### v0.9.0 (Current)
- ✅ Basic infrastructure (daemon, LSP client)
- ✅ Project management (init, remove, configure)
- ✅ Code inspection (diagnostics only, fixes not working)
- ✅ Navigation commands: definition, references
- ⚠️ Known issues: `list` command display, `--fix` not generating actions, dev mode broken

### v1.0 (Target)
- [x] References navigation (completed)
- [ ] Complete navigation suite (type, impl, symbols)
- [ ] Code understanding tools (hover, signature, outline)
- [ ] Refactoring commands (rename, extract)
- [ ] Enhanced output formatting
- [ ] Performance optimizations

### Future
- [ ] Multi-language support (Python, Rust, Go)
- [ ] Advanced analysis (complexity, dependencies)
- [ ] Plugin system
- [ ] Collaborative features

## Contributing

We welcome contributions! Please see our [implementation plan](./docs/IMPLEMENTATION_PLAN.md) for current priorities.

## License

ISC