# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LSP-Top is a command-line Language Server Protocol client that provides IDE-level code intelligence in terminal environments. It acts as "grep for code understanding" - enabling navigation, analysis, and refactoring of TypeScript codebases through CLI commands.

## Essential Commands

### Build & Development
```bash
# Install dependencies
pnpm install

# Build the project (TypeScript -> JavaScript in /dist)
pnpm run build

# Run in development mode
pnpm run dev -- <command>

# Run tests
pnpm test

# Type checking
pnpm run typecheck

# Run a single test file
pnpm test src/tests/<test-file>.test.ts
```

### Testing LSP Commands
```bash
# During development, test commands with:
pnpm run dev -- init <project-path>
pnpm run dev -- run definition <project-alias> <file>:<line>:<col>
pnpm run dev -- run references <project-alias> <file>:<line>:<col>
pnpm run dev -- run diagnostics <project-alias> <file>
```

## Architecture

### Three-Layer Design
1. **CLI Layer** (`src/cli.ts`) - Parses commands, handles user interaction
2. **Daemon Layer** (`src/daemon.ts`) - Manages persistent LSP sessions via Unix socket at `/tmp/lsp-top.sock`
3. **LSP Client Layer** (`src/lsp-client.ts`) - Abstracts LSP protocol communication

### Key Components
- **TypeScript Server** (`src/servers/typescript.ts`) - Wraps @vtsls/language-server
- **Logger** (`src/logging.ts`) - Structured logging with performance metrics
- **Project Manager** - Alias system stored in `~/.config/lsp-top/config.json`

### Communication Flow
```
User → CLI → Unix Socket → Daemon → LSP Client → Language Server
     ←     ← JSON Response ←       ←            ←
```

## Code Patterns & Conventions

### Command Implementation Pattern
When adding new LSP commands:
1. Add command definition in `src/cli.ts`
2. Implement handler in daemon (`src/daemon.ts`)
3. Add LSP method in `src/lsp-client.ts`
4. Update TypeScript wrapper in `src/servers/typescript.ts`
5. Add tests in `src/tests/`

### Error Handling
- Use specific exit codes (defined in `src/cli.ts`)
- Always provide structured error responses
- Include timing metrics in responses
- Log errors with appropriate levels (debug/info/error)

### Testing Approach
- Integration tests for CLI commands use the test project in `test-project/`
- Mock LSP responses for unit tests
- Test both success and error scenarios
- Verify JSON output structure matches schemas

## Current Implementation Status

### Working Commands
- `init/list/remove` - Project management
- `run definition` - Go to definition
- `run references` - Find references  
- `run diagnostics` - Get type/syntax errors
- `edit apply/plan` - Apply WorkspaceEdits

### Not Yet Implemented
- Type definitions, implementations
- Hover information, signature help
- Symbol search (document/workspace)
- Rename refactoring
- Code actions beyond quick fixes

## Important Notes

### Version Philosophy
- **No Backward Compatibility Required** - This project has never been released publicly
- **Always Version 1.0** - We are iterating on ideas, not maintaining legacy code
- **No Migration Code** - Never write migration or compatibility layers for old commands/APIs
- **Free to Break Things** - Feel free to completely restructure commands and APIs as needed
- **Clean Slate Approach** - When improving the design, don't preserve old patterns

### Performance Considerations
- Daemon keeps LSP sessions warm for <100ms response times
- Document lifecycle (open/change/close) is managed automatically
- Diagnostic caching reduces redundant LSP calls

### Configuration
- Project aliases stored in `~/.config/lsp-top/config.json`
- Supports both relative and absolute paths
- Config auto-creates on first use

### Output Formats
- Human-readable text by default
- JSON with `--json` flag (schema-versioned)
- Structured responses include timing metrics

## Common Development Tasks

### Adding a New LSP Command
1. Define command interface in types
2. Add CLI command handler
3. Implement daemon message handler
4. Add LSP client method
5. Update TypeScript server wrapper
6. Write integration tests

### Debugging
- Set `DEBUG=*` for verbose logging
- Check daemon logs for LSP communication
- Use `--json` to inspect raw responses
- Test with `test-project/` for consistent scenarios

### Testing Changes
Always run before committing:
```bash
pnpm run build
pnpm test
pnpm run typecheck
```

## Project Philosophy

This project prioritizes:
- **Terminal-first experience** - Works everywhere (SSH, CI/CD, containers)
- **AI-friendly output** - Structured JSON for automation
- **Performance** - Sub-100ms responses via persistent daemon
- **Simplicity** - Clear command structure, predictable behavior