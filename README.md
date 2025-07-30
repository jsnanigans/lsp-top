# LSP-Top

A CLI wrapper around LSP servers that allows you to run language server actions from anywhere in your terminal.

## Features

- **Project Aliases**: Register project directories with simple aliases
- **Path Resolution**: Use relative paths that are automatically resolved to your project root
- **LSP Integration**: Currently supports TypeScript via vtsls
- **Stateless**: No background daemons - LSP servers start on-demand per command

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Optionally install globally
npm link
```

## Quick Start

```bash
# Register a project with an alias
lsp-top init myproject /path/to/project

# Run diagnostics on a file (from anywhere)
lsp-top run myproject diagnostics src/index.ts

# Go to definition at a specific position
lsp-top run myproject definition src/index.ts:10:5
```

## Commands

### Project Management

```bash
# Initialize a project with an alias
lsp-top init <alias> [path]

# List all configured projects
lsp-top list

# Remove a project alias
lsp-top remove <alias>
```

### LSP Actions

```bash
# Run an LSP action for a project
lsp-top run <alias> <action> [args...]
```

#### Available Actions

- **`diagnostics <file>`**: Get TypeScript diagnostics for a file
- **`definition <file:line:col>`**: Go to definition at a specific position

## Examples

```bash
# Setup
lsp-top init webapp ~/projects/webapp
lsp-top init api ~/work/backend-api

# Get diagnostics (from anywhere)
lsp-top run webapp diagnostics components/Button.tsx
lsp-top run api diagnostics src/controllers/user.ts

# Go to definition
lsp-top run webapp definition src/utils.ts:45:12
```

## Requirements

- Node.js 18+
- TypeScript projects require `@vtsls/language-server` to be installed:
  ```bash
  pnpm add -D @vtsls/language-server
  ```

## Configuration

Project aliases are stored in `~/.lsp-top/aliases.json`.

## Architecture

- **Stateless**: Each command starts a fresh LSP server and exits
- **Path Resolution**: File paths are automatically resolved relative to the project root
- **LSP Protocol**: Uses proper LSP client-server communication with JSON-RPC over stdio

## Development

```bash
# Run in development mode
pnpm run dev -- <command>

# Build
pnpm run build

# Example development usage
pnpm run dev init test .
pnpm run dev run test diagnostics src/cli.ts
```

## Extending

The architecture supports adding:
- More LSP servers (Python, Go, etc.)
- Composite actions that chain multiple LSP calls
- Custom project-specific configurations

## Roadmap

- [ ] Support for more language servers
- [ ] Composite actions (analyze_symbol, improve_code)
- [ ] Configuration file support
- [ ] Better error handling and user feedback
- [ ] Shell completion

## License

ISC