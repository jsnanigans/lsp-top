# LSP-Top

A fast CLI for running Language Server actions from anywhere. It manages a lightweight daemon and per-project aliases so you can query LSP features (Diagnostics, Go to Definition, more soon) without switching directories.

## Highlights

- Project aliases: `web -> ~/code/webapp`
- Smart path resolution relative to project root
- LSP-backed actions (TypeScript via @vtsls/language-server)
- Daemonized for speed: background server multiplexes requests
- JSON output mode for scripting

## Installation

```bash
pnpm install
pnpm run build
npm link
```

Requirements: Node.js 18+. For TypeScript projects install @vtsls/language-server in the project you target:
```bash
pnpm add -D @vtsls/language-server
```

## Quick Start

```bash
# 1) Alias a project
lsp-top init web ~/projects/webapp

# 2) Start the daemon (recommended)
lsp-top start-server

# 3) Run actions from anywhere
lsp-top run web diagnostics src/index.ts
lsp-top run web definition src/index.ts:10:5
```

## CLI Usage

Global options:
- -v, --verbose
- -q, --quiet
- --json
- --log-level <error|warn|info|debug|trace>
- --trace <flags>

### Project management

Init a project alias
```bash
lsp-top init <alias> [path]
```
- alias: name for the project
- path: absolute or relative; defaults to current directory

List aliases
```bash
lsp-top list
```

Remove an alias
```bash
lsp-top remove <alias>
```

Configure and inspect
```bash
lsp-top configure --set-alias <alias:path>
lsp-top configure --print [--env NODE_ENV,HOME] [--json]
```

### Daemon control and status

Start daemon
```bash
lsp-top start-server [--verbose] [--log-level <level>] [--trace <flags>]
```

Show daemon metrics/status
```bash
lsp-top metrics [--json]
```

Follow daemon logs
```bash
lsp-top logs [--tail <n>] [--follow]
```

Stop daemon
```bash
lsp-top stop-server
```

### LSP actions

Run an action
```bash
lsp-top run <alias> <action> [args...] [--json] [-v|--log-level <lvl>] [--trace <flags>]
```

Actions (TypeScript via vtsls):
- diagnostics <file>
  - Returns TypeScript diagnostics for the file
  - Example: `lsp-top run web diagnostics src/components/Button.tsx`
- definition <file:line:column>
  - Returns definition locations
  - Example: `lsp-top run web definition src/utils.ts:45:12`

Environment diagnosis
```bash
lsp-top diagnose [alias] [--json]
```
- Checks Node version, @vtsls/language-server availability, and an alias’s path

## Output formats

Text (default) prints human-friendly strings. JSON mode prints a single JSON object per invocation, suitable for scripting:
```bash
lsp-top run web diagnostics src/index.ts --json
```

## Path resolution

File arguments are resolved relative to the aliased project root. Absolute paths are supported and used as-is.

## Configuration files

Aliases are stored in `~/.lsp-top/aliases.json`.

## Examples

```bash
lsp-top init api ~/work/backend-api
lsp-top run api diagnostics src/controllers/user.ts
lsp-top run api definition src/index.ts:12:3
```

## Development

```bash
pnpm run dev -- <cmd>
pnpm run dev -- init test .
pnpm run dev -- run test diagnostics src/cli.ts
pnpm run build
```

## Roadmap

- More language servers (pyright, gopls, rust-analyzer)
- Composite actions (symbol analysis, refactors)
- Config file support
- Richer errors and UX
- Shell completion

## License

ISC
