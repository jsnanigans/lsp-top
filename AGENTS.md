# AGENTS GUIDE

Build/lint/test
- Install: pnpm install
- Build: pnpm run build (tsc)
- Dev entry: pnpm run dev -- <args> (or use node dist/cli-new.js <args>)
- Typecheck: pnpm run build --noEmit false (tsc checks)
- Lint: none configured (no eslint/prettier). Do not add.
- Tests (root): none configured; use test-project for examples; manual CLI testing commands below
- Tests (test-project): pnpm --filter test-project test
- Single test (jest in test-project): pnpm --filter test-project jest path/to/test.ts -t "test name"

Manual CLI testing (NEW API - no aliases/project management needed):
- Definition: node dist/cli-new.js definition src/calculator.ts:11:3
- References: node dist/cli-new.js references src/calculator.ts:4:14
- Diagnostics: node dist/cli-new.js diagnostics src/index.ts
- Hover: node dist/cli-new.js hover src/calculator.ts:4:14
- Symbols: node dist/cli-new.js symbols src/index.ts
- Inspect: node dist/cli-new.js inspect src/index.ts
- Inspect changed: node dist/cli-new.js inspect-changed
- Daemon status: node dist/cli-new.js daemon-status
- Stop daemon: node dist/cli-new.js stop-daemon
- Logs: node dist/cli-new.js logs [--tail N] [--follow]

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