# Changelog

## [1.0.0] - 2025-08-08

### Unified Version
- Consolidated all CLI functionality into a single unified version
- Removed legacy v1 code and v2 references
- Simplified codebase structure

### Core Features
- **Navigation**: Go to definition, find references, type definitions, implementations
- **Exploration**: Hover information, symbol listing, file outlines
- **Analysis**: File diagnostics, changed file analysis with Git integration
- **Refactoring**: Symbol renaming, import organization (with --preview/--write safety)
- **Daemon Management**: Auto-start, health monitoring, crash recovery

### Improvements
- Added comprehensive error handling and recovery
- Fixed TypeScript language server diagnostics issue
- Added health check commands for daemon and LSP servers
- Improved error messages with user-friendly formatting
- Added extensive help text with examples for all commands
- Created quick reference guide

### Architecture
- Single CLI entry point (`src/cli.ts`)
- Unified daemon implementation (`src/daemon.ts`)
- Robust LSP client with crash recovery
- Beautiful human-readable output formatting
- Schema-versioned JSON output for automation

### Performance
- Sub-millisecond response times via persistent daemon
- Automatic daemon lifecycle management
- 5-minute inactivity timeout for resource efficiency

### Documentation
- Comprehensive README with examples
- Quick reference guide for all commands
- Inline help with practical examples
- Agent guide for development

### Removed
- Legacy v1 CLI implementation
- Migration guides and compatibility layers
- Version-specific references in documentation
- Redundant code paths and files