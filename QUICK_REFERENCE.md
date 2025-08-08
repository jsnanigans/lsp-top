# LSP-Top Quick Reference

## Installation & Setup
```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run directly (development)
pnpm run dev <command>

# Run compiled version
node dist/cli.js <command>
```

## Command Structure
```
lsp-top [global-options] <command> <subcommand> [options] <arguments>
```

## Global Options
- `--json` - Output machine-readable JSON
- `--verbose` - Enable verbose logging
- `--quiet` - Suppress non-error output
- `--preview` - Preview changes without applying (for refactoring)
- `--write` - Apply changes to disk (for refactoring)

## Navigation Commands

### Go to Definition
```bash
lsp-top navigate def src/index.ts:10:5
lsp-top nav def src/utils.ts:25:10 --context 5
```

### Find References
```bash
lsp-top navigate refs src/calculator.ts:4:14
lsp-top nav refs src/api.ts:10:5 --group-by-file --limit 10
```

### Go to Type Definition
```bash
lsp-top navigate type src/index.ts:10:5
```

### Find Implementations
```bash
lsp-top navigate impl src/interfaces/Service.ts:3:11
```

## Exploration Commands

### Get Hover Information
```bash
lsp-top explore hover src/index.ts:10:5
```

### List Document Symbols
```bash
lsp-top explore symbols src/index.ts
lsp-top exp symbols src/api.ts --query "user"
lsp-top exp symbols src/utils.ts --kind function
```

### Get File Outline
```bash
lsp-top explore outline src/components/App.tsx
```

### Search Project-Wide Symbols
```bash
lsp-top explore project-symbols                    # All symbols
lsp-top explore project-symbols user               # Search for "user"
lsp-top exp ps --kind class --limit 20            # All classes
lsp-top exp ps --project ~/other-app              # Different project
```

### Show Call Hierarchy
```bash
lsp-top explore call-hierarchy src/api.ts:25:10 --direction in   # Who calls this?
lsp-top explore calls src/api.ts:25:10 --direction out          # What does it call?
lsp-top exp calls src/api.ts:25:10 --direction both            # Both directions
```

### Show Type Hierarchy
```bash
lsp-top explore type-hierarchy src/models/User.ts:5:14 --direction super  # What it extends
lsp-top explore types src/interface.ts:3:11 --direction sub              # What extends it
lsp-top exp types src/base.ts:10:7 --direction both                     # Full hierarchy
```

## Analysis Commands

### Analyze Single File
```bash
lsp-top analyze file src/index.ts
lsp-top analyze file src/api.ts --fix  # Show quick fixes
```

### Analyze Changed Files
```bash
lsp-top analyze changed              # All changed files
lsp-top analyze changed --staged     # Only staged files
lsp-top analyze changed --fix        # With quick fixes
```

### Analyze Entire Project
```bash
lsp-top analyze project                           # Current project errors
lsp-top analyze project --summary                 # Summary only
lsp-top analyze project --severity warning        # Include warnings
lsp-top analyze project --project ~/my-app        # Different project
lsp-top an project --limit 10 --severity error   # Limit output
```

## Refactoring Commands

### Rename Symbol
```bash
# Preview changes
lsp-top refactor rename src/calculator.ts:4:14 NewName --preview

# Apply changes
lsp-top refactor rename src/api.ts:10:5 newFunction --write
```

### Organize Imports
```bash
# Preview changes
lsp-top refactor organize-imports src/index.ts --preview

# Apply changes
lsp-top refactor organize-imports src/index.ts --write
```

## Daemon Management

### Status & Health
```bash
lsp-top daemon status    # Check if running
lsp-top daemon health    # Check health of daemon and LSP servers
```

### Start/Stop/Restart
```bash
lsp-top daemon start     # Start manually
lsp-top daemon stop      # Stop daemon
lsp-top daemon restart   # Restart (useful after crashes)
```

### View Logs
```bash
lsp-top daemon logs --tail 50      # Last 50 lines
lsp-top daemon logs --follow        # Follow output
lsp-top daemon logs --tail 100 | grep ERROR  # Filter errors
```

## Common Workflows

### Debug Issues
```bash
# 1. Check daemon health
lsp-top daemon health

# 2. If unhealthy, restart
lsp-top daemon restart

# 3. Check logs for errors
lsp-top daemon logs --tail 50

# 4. Run with verbose output
lsp-top analyze file src/index.ts --verbose
```

### Code Review
```bash
# Check file for issues
lsp-top analyze file src/index.ts

# Find all references to a function
lsp-top navigate refs src/api.ts:25:10 --group-by-file

# Check type information
lsp-top explore hover src/models/User.ts:10:5
```

### Refactoring
```bash
# 1. Find all references first
lsp-top navigate refs src/old.ts:10:5

# 2. Preview rename
lsp-top refactor rename src/old.ts:10:5 newName --preview

# 3. Apply if looks good
lsp-top refactor rename src/old.ts:10:5 newName --write
```

## File Location Format
All commands that need a position use the format:
```
<file>:<line>:<column>
```
- `file` - Path to file (relative or absolute)
- `line` - Line number (1-based)
- `column` - Column number (1-based)

Example: `src/index.ts:10:5` means line 10, column 5 in src/index.ts

## Output Formats

### Default (Human-Readable)
```bash
lsp-top analyze file src/index.ts
```

### JSON (Machine-Readable)
```bash
lsp-top analyze file src/index.ts --json
```

## Tips

1. **Daemon Auto-Management**: The daemon starts automatically when needed and stops after 5 minutes of inactivity
2. **Project Discovery**: Commands automatically find the nearest `tsconfig.json`
3. **Project Selection**: Use `--project <path>` to analyze any project from anywhere
4. **Project Root Display**: All project commands show which project they're analyzing
5. **Safety First**: Refactoring commands require `--preview` or `--write` flag
6. **Performance**: Keep daemon running for faster responses (sub-100ms)
7. **Debugging**: Use `--verbose` flag and check daemon logs when issues occur

## Error Recovery

If you encounter errors:
1. Check file exists: `ls <file>`
2. Check daemon health: `lsp-top daemon health`
3. Restart daemon: `lsp-top daemon restart`
4. Check logs: `lsp-top daemon logs --tail 50`
5. Run with verbose: `<command> --verbose`