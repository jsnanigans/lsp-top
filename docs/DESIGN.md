# LSP-Top CLI Design v2

## Purpose

A powerful command-line IDE that provides Language Server Protocol functionality through an intuitive CLI interface. LSP-Top enables developers and AI agents to understand, navigate, and refactor codebases without traditional editors, making it the "grep for code understanding."

## Core Philosophy

- **Information First**: Every command provides rich, contextual information
- **Progressive Disclosure**: Simple defaults with detailed options
- **Composable**: Commands work together via pipes and scripts
- **Context-Aware**: Show surrounding code, not just positions
- **Action-Oriented**: From information to action in one step

## Guiding Principles

- **Minimal, orthogonal verbs**: Cover 90% of use cases without combinatorial flags
- **Consistent shapes**: Positions (file:line:col), ranges (start:end or L1:C1-L2:C2)
- **Safe by default**: `--preview` shows changes, `--write` applies them
- **Scriptable**: `--json` everywhere with versioned schemas
- **Fast feedback**: Persistent daemon, intelligent caching, <200ms response times
- **Human and AI friendly**: Readable output for humans, structured JSON for machines

## Command Structure

### Top-Level Command Groups

1. **navigate** - Code navigation (def, refs, type, impl, symbols)
2. **explore** - Code understanding (hover, signature, outline, symbols)
3. **analyze** - Code quality (diagnostics, unused code, complexity)
4. **refactor** - Code transformation (rename, extract, organize)
5. **search** - Find code (text, symbols, patterns)
6. **edit** - Direct editing (apply, plan)
7. **project** - Project management (init, list, remove)
8. **daemon** - Service management (start, stop, status)

### Global Conventions

- **Options**: `-v, --verbose`, `-q, --quiet`, `--json`, `--log-level <level>`, `--trace <flags>`
- **Position**: `file.ts:line:col` (1-based)
- **Range**: `start:end` or `L1:C1-L2:C2`
- **Output**: Human-readable by default, JSON with `--json`
- **Exit codes**: 0 (success), 1 (error), 2 (no result)
- **Project context**: Via alias or auto-detected from cwd

## Command Reference

### Navigate - Code Navigation

```bash
navigate def <file:line:col>                    # Go to definition
navigate refs <file:line:col> [options]         # Find references
  --include-declaration                         # Include the declaration
  --context <n>                                 # Lines of context (default: 2)
  --group-by-file                              # Group results by file
  --limit <n>                                  # Limit results
navigate type <file:line:col>                   # Go to type definition
navigate impl <file:line:col>                   # Find implementations
navigate symbol <query> [options]               # Search symbols by name
  --kind <kind>                                # Filter by kind
  --scope <file|workspace>                     # Search scope
  --exact                                      # Exact match only
```

### Explore - Code Understanding

```bash
explore hover <file:line:col>                   # Show type info and docs
explore signature <file:line:col>               # Show signature help
explore symbols <file> [options]                # List file symbols
  --tree                                       # Tree structure
  --kind <kind>                                # Filter by kind
explore outline <file>                          # Document outline
explore type-def <file:line:col>                # Full type definition
```

### Analyze - Code Quality

```bash
analyze file <file> [options]                   # Analyze single file
  --severity <level>                           # Min severity
  --fix-preview                                # Show available fixes
  --fix                                        # Apply fixes
analyze changed [options]                       # Analyze git changes
  --staged                                     # Only staged files
  --since <ref>                                # Changes since ref
  --fix                                        # Apply fixes
analyze unused [options]                        # Find unused code
  --type <exports|variables|imports|all>       # Type of unused code
analyze complexity <file>                       # Complexity metrics
```

### Refactor - Code Transformation

```bash
refactor rename <file:line:col> <newName> [options]
  --preview                                    # Preview changes
  --interactive                                # Confirm each change
refactor extract-function <file:range> <name> [options]
  --target <location>                          # Where to place
  --async                                      # Make async
refactor extract-variable <file:range> <name>
refactor inline <file:line:col>
refactor organize-imports <file>
refactor format <file> [options]
  --check                                      # Check only
```

### Search - Find Code

```bash
search text <pattern> [options]                 # Text search
  --glob <pattern>                             # File pattern
  --ignore <pattern>                           # Ignore pattern
search symbol <query> [options]                 # Symbol search
  --kind <kind>                                # Symbol kind
  --workspace                                  # Search workspace
```

### Edit - Direct Editing

```bash
edit apply <file>                               # Apply WorkspaceEdit
edit plan <file> [options]                      # Create edit plan
  --from <rev>                                 # From revision
  --to <rev>                                   # To revision
```

### Project Management

```bash
project init <alias> [path]                     # Initialize project
project list                                    # List projects
project remove <alias>                          # Remove project
project run <alias> -- <command>                # Run in project context
```

### Daemon Management

```bash
daemon start [options]                          # Start daemon
  --log-level <level>
  --trace <flags>
daemon stop                                     # Stop daemon
daemon status                                   # Check status
daemon logs [options]                           # View logs
  --tail <n>
  --follow
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

  Documentation:
  Processes the user data and returns a result.
```

### JSON Format (--json)

```json
{
  "schemaVersion": "v2",
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
        { "number": 22, "text": "  async process(): Promise<Result> {" },
        { "number": 23, "text": "    // Process user data" }
      ],
      "highlight": { "line": 22, "start": 4, "end": 11 }
    },
    "documentation": "Processes the user data and returns a result."
  }
}
```

## JSON Schemas

### Location

```typescript
interface Location {
  uri: string;
  range: Range;
  preview?: Preview;
}

interface Range {
  start: Position;
  end: Position;
}

interface Position {
  line: number; // 0-based
  character: number; // 0-based
}

interface Preview {
  lines: PreviewLine[];
  highlight?: Highlight;
}
```

### CommandResult

```typescript
interface CommandResult<T = any> {
  schemaVersion: "v2";
  ok: boolean;
  command: string;
  data?: T;
  error?: string;
  code?: string;
}
```

## Implementation Architecture

### Daemon Architecture

- Unix socket at `/tmp/lsp-top.sock`
- Single-writer policy
- Persistent LSP connections per project
- Intelligent caching with invalidation

### Performance Targets

- Navigation commands: < 100ms
- Analysis commands: < 500ms
- Refactoring preview: < 1s
- Memory usage: < 200MB per project

### Language Server Integration

- Primary: TypeScript (tsserver)
- Future: Python (pylsp), Rust (rust-analyzer), Go (gopls)
- Graceful degradation for missing features

## Use Cases

### Human Developer

```bash
# Quick navigation
lsp-top navigate def src/api.ts:30:15
lsp-top navigate refs src/core.ts:User:10:5 --limit 10

# Understanding code
lsp-top explore hover src/complex.ts:45:20
lsp-top explore symbols src/module.ts --tree

# Safe refactoring
lsp-top refactor rename src/old.ts:10:5 "newName" --preview
lsp-top analyze changed --fix
```

### AI Agent

```python
# Analyze codebase
result = run_command("lsp-top analyze file src/service.ts --json")
diagnostics = json.loads(result)["data"]["diagnostics"]

# Navigate code
definition = run_command("lsp-top navigate def src/api.ts:30:15 --json")
location = json.loads(definition)["data"]["location"]

# Refactor safely
preview = run_command('lsp-top refactor rename src/old.ts:10:5 "new" --preview --json')
if len(preview["data"]["changes"]) < 10:
    run_command('lsp-top refactor rename src/old.ts:10:5 "new"')
```

## Migration Path

### From v1 to v2

- Old: `lsp-top run <alias> definition <args>`
- New: `lsp-top navigate def <args>`
- Compatibility layer maintains old commands

### Incremental Adoption

1. Phase 1: Core navigation commands
2. Phase 2: Explore commands
3. Phase 3: Refactoring commands
4. Phase 4: Analysis and search
5. Phase 5: Command structure migration

## Success Metrics

- **Adoption**: Used in 50+ projects within 6 months
- **Performance**: 95th percentile < 200ms for navigation
- **Reliability**: 99.9% uptime for daemon
- **Usability**: Complete common tasks in 1-2 commands
- **Integration**: Used by 5+ AI coding assistants

## Future Enhancements

- Multi-language support beyond TypeScript
- Integration with build tools and linters
- Tree-sitter for syntax-aware operations
- Collaborative features for team development
- Plugin system for custom commands
