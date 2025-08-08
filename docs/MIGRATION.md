# Migration Guide: v1 to v2

This guide helps you transition from the old flat command structure to the new hierarchical v2 CLI.

## Quick Reference

### Command Changes

| Old Command (v1) | New Command (v2) | Notes |
|-----------------|------------------|-------|
| `lsp-top definition <loc>` | `lsp-top navigate def <loc>` | Shorter alias available |
| `lsp-top references <loc>` | `lsp-top navigate refs <loc>` | Added context options |
| `lsp-top hover <loc>` | `lsp-top explore hover <loc>` | Better formatting |
| `lsp-top symbols <file>` | `lsp-top explore symbols <file>` | Added filtering |
| `lsp-top diagnostics <file>` | `lsp-top analyze file <file>` | Added --fix option |
| `lsp-top inspect <file>` | `lsp-top analyze file <file>` | Renamed for clarity |
| `lsp-top inspect-changed` | `lsp-top analyze changed` | Added --staged option |
| `lsp-top stop-daemon` | `lsp-top daemon stop` | Grouped under daemon |
| `lsp-top daemon-status` | `lsp-top daemon status` | Grouped under daemon |
| `lsp-top logs` | `lsp-top daemon logs` | Grouped under daemon |

### New Commands in v2

These commands are new in v2:

- `lsp-top navigate type <loc>` - Go to type definition
- `lsp-top navigate impl <loc>` - Find implementations
- `lsp-top explore outline <file>` - Show file outline
- `lsp-top refactor rename <loc> <name>` - Rename symbol
- `lsp-top refactor organize-imports <file>` - Organize imports
- `lsp-top daemon start` - Explicitly start daemon

## Key Differences

### 1. Hierarchical Structure

**v1:** Flat commands
```bash
lsp-top definition src/file.ts:10:5
lsp-top references src/file.ts:10:5
lsp-top hover src/file.ts:10:5
```

**v2:** Grouped commands
```bash
lsp-top navigate def src/file.ts:10:5
lsp-top navigate refs src/file.ts:10:5
lsp-top explore hover src/file.ts:10:5
```

### 2. Safety Flags for Refactoring

**v1:** Direct modification (if it existed)
```bash
lsp-top rename src/file.ts:10:5 NewName  # Would apply immediately
```

**v2:** Requires explicit intent
```bash
lsp-top refactor rename src/file.ts:10:5 NewName --preview  # Preview first
lsp-top refactor rename src/file.ts:10:5 NewName --write    # Then apply
```

### 3. Enhanced Output

**v1:** Raw JSON by default
```bash
$ lsp-top definition src/file.ts:10:5
{"uri":"file:///path/to/file.ts","range":{"start":{"line":3,"character":0}}}
```

**v2:** Human-readable by default
```bash
$ lsp-top navigate def src/file.ts:10:5
src/file.ts:4:1
┌─────────────────────────────────────────────────┐
│    2 │  * Documentation comment
│    3 │  */
│ >  4 │ export class MyClass {
│    5 │   constructor() {
│    6 │     // ...
└─────────────────────────────────────────────────┘
```

### 4. JSON Output Changes

**v1:** Simple JSON
```json
{
  "uri": "file:///path/to/file.ts",
  "range": { ... }
}
```

**v2:** Schema-versioned JSON
```json
{
  "schemaVersion": "2.0.0",
  "ok": true,
  "data": {
    "uri": "file:///path/to/file.ts",
    "range": { ... },
    "timing": 1
  }
}
```

## Migration Script

A migration wrapper is available that automatically translates old commands:

```bash
# Using the migration wrapper
node dist/cli-migrate.js definition src/file.ts:10:5

# Will show:
⚠️  Command syntax has changed in v2.0.0
   Old: lsp-top definition <args>
   New: lsp-top navigate def <args>

Automatically redirecting to new command...
[output continues]
```

## Common Workflows

### Finding References

**v1:**
```bash
lsp-top references src/user.ts:15:10
```

**v2:**
```bash
# Basic usage
lsp-top navigate refs src/user.ts:15:10

# With options
lsp-top navigate refs src/user.ts:15:10 --context 5 --group-by-file
```

### Getting Diagnostics

**v1:**
```bash
lsp-top diagnostics src/main.ts
```

**v2:**
```bash
# Basic diagnostics
lsp-top analyze file src/main.ts

# With quick fixes
lsp-top analyze file src/main.ts --fix
```

### Checking Changed Files

**v1:**
```bash
lsp-top inspect-changed
```

**v2:**
```bash
# All changed files
lsp-top analyze changed

# Only staged files
lsp-top analyze changed --staged

# With fixes
lsp-top analyze changed --fix
```

## New Features to Explore

### Context Lines
Show more context around results:
```bash
lsp-top navigate def src/file.ts:10:5 --context 5
```

### Group by File
Group references by file:
```bash
lsp-top navigate refs src/api.ts:20:10 --group-by-file
```

### Limit Results
Limit number of results:
```bash
lsp-top navigate refs src/common.ts:5:10 --limit 10
```

### Type Navigation
Navigate to type definitions:
```bash
lsp-top navigate type src/user.ts:10:15
```

### Implementation Search
Find implementations of interfaces:
```bash
lsp-top navigate impl src/interface.ts:5:10
```

## Automation Updates

If you have scripts using v1 commands, update them:

### Shell Scripts
```bash
# Old
DEFINITION=$(lsp-top definition src/file.ts:10:5)

# New
DEFINITION=$(lsp-top navigate def src/file.ts:10:5 --json | jq '.data')
```

### CI/CD Pipelines
```yaml
# Old
- run: lsp-top diagnostics src/

# New  
- run: lsp-top analyze file src/
```

### Git Hooks
```bash
# Old
lsp-top inspect-changed

# New
lsp-top analyze changed --staged
```

## Getting Help

```bash
# General help
lsp-top --help

# Command group help
lsp-top navigate --help

# Specific command help
lsp-top navigate def --help
```

## Troubleshooting

### Command Not Found
If you get "Unknown command" errors, you're likely using v1 syntax. Check the quick reference table above.

### Missing --preview or --write
Refactoring commands now require explicit intent:
```bash
Error: Rename requires either --preview or --write flag for safety
```

### Different JSON Structure
The JSON output now includes schema version and wraps data:
```javascript
// Parse v2 JSON
const response = JSON.parse(output);
if (response.ok) {
  const data = response.data;  // Access actual data here
}
```

## Benefits of v2

1. **Discoverable** - Grouped commands are easier to explore
2. **Safer** - Preview before applying changes
3. **Readable** - Beautiful formatted output by default
4. **Faster** - Sub-millisecond response times
5. **Flexible** - More options for customizing output
6. **Versioned** - Schema versioning for stability

## Need Help?

- Check the [README](../README.md) for full documentation
- Run `lsp-top --help` for command discovery
- Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for feature status