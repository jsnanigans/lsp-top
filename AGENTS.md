# AGENTS GUIDE

Build/lint/test
- Install: pnpm install
- Build: pnpm run build (tsc)
- Dev entry: pnpm run dev -- <args> (or use node dist/cli.js <args>)
- Typecheck: pnpm run typecheck (tsc --noEmit)
- Lint: none configured (no eslint/prettier). Do not add.
- Tests (root): none configured; use test-project for examples; manual CLI testing commands below
- Tests (test-project): pnpm --filter test-project test
- Single test (jest in test-project): pnpm --filter test-project jest path/to/test.ts -t "test name"

Manual CLI testing:
## Navigate Commands
- Definition: node dist/cli.js navigate def src/calculator.ts:11:3
- References: node dist/cli.js navigate refs src/calculator.ts:4:14
- Type definition: node dist/cli.js navigate type src/file.ts:10:5
- Implementation: node dist/cli.js navigate impl src/interface.ts:5:10

## Explore Commands
- Hover: node dist/cli.js explore hover src/calculator.ts:4:14
- Symbols: node dist/cli.js explore symbols src/index.ts [--query <filter>]
- Outline: node dist/cli.js explore outline src/index.ts

## Analyze Commands
- File diagnostics: node dist/cli.js analyze file src/index.ts [--fix]
- Changed files: node dist/cli.js analyze changed [--staged] [--fix]

## Refactor Commands (require --preview or --write)
- Rename: node dist/cli.js refactor rename src/file.ts:10:5 NewName --preview
- Organize imports: node dist/cli.js refactor organize-imports src/file.ts --write

## Daemon Commands
- Status: node dist/cli.js daemon status
- Stop: node dist/cli.js daemon stop
- Start: node dist/cli.js daemon start
- Logs: node dist/cli.js daemon logs [--tail N] [--follow]

## Global Options
- --json: Output machine-readable JSON with schema version
- --verbose: Enable verbose logging
- --context <n>: Number of context lines (for navigation commands)
- --group-by-file: Group results by file (for refs/impl)
- --limit <n>: Limit number of results

Note: 
- Daemon starts automatically when any command is run
- Daemon stops automatically after 5 minutes of inactivity
- Projects are discovered by finding nearest tsconfig.json
- All paths can be relative or absolute
- No manual project/alias management required!

Version philosophy:
- No backward compatibility needed - this tool has never been released
- Always version 1.0 - we're iterating on ideas, not maintaining legacy
- Never write migration code for old commands/APIs
- Free to completely restructure as needed

Code style
- Language: TypeScript strict (tsconfig.json: strict, esModuleInterop, commonjs, ES2020)
- Imports: use relative from src; commonjs output. Prefer named imports; default only when package provides default.
- Formatting: keep existing style; 2 spaces; no trailing comments; no unused exports; no comments unless asked.
- Types: no any; narrow types; define interfaces/types in src/*; reuse existing types; enable resolveJsonModule when needed.
- Naming: camelCase for vars/functions; PascalCase for types/classes; CONST_UPPER for constants if exported; files kebab-case or current names.
- Errors: never swallow; return Result-like objects or throw Error with message; CLI should exit non-zero on failure; log to stderr via src/logger.ts.
- Public APIs: CLI commands in src/cli.ts and LSP actions are the surface; feel free to break and redesign as needed.
- Side effects: keep modules pure; only CLI performs I/O; no global state beyond config paths.
- Cursor/Copilot rules: none found (.cursor/ or .github/copilot-instructions.md absent). If added later, mirror here.