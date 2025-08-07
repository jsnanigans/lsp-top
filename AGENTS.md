# AGENTS GUIDE

Build/lint/test
- Install: pnpm install
- Build: pnpm run build (tsc)
- Dev entry: node dist/cli.js <args> (pnpm run dev currently broken; use built CLI)
- Typecheck: pnpm run build --noEmit false (tsc checks)
- Lint: none configured (no eslint/prettier). Do not add.
- Tests (root): none configured; use test-project for examples; manual CLI testing commands below
- Tests (test-project): pnpm --filter test-project test
- Single test (jest in test-project): pnpm --filter test-project jest path/to/test.ts -t "test name"

Manual CLI testing:
- Start daemon: node dist/cli.js start-server
- Init test project: node dist/cli.js init test ./test-project
- Definition: node dist/cli.js run test definition src/calculator.ts:11:3
- References: node dist/cli.js run test references src/calculator.ts:4:14
- Diagnostics: node dist/cli.js run test diagnostics src/index.ts
- Inspect: node dist/cli.js inspect test file src/index.ts
- Config: node dist/cli.js configure --print
- Metrics: node dist/cli.js metrics

Code style
- Language: TypeScript strict (tsconfig.json: strict, esModuleInterop, commonjs, ES2020)
- Imports: use relative from src; commonjs output. Prefer named imports; default only when package provides default.
- Formatting: keep existing style; 2 spaces; no trailing comments; no unused exports; no comments unless asked.
- Types: no any; narrow types; define interfaces/types in src/*; reuse existing types; enable resolveJsonModule when needed.
- Naming: camelCase for vars/functions; PascalCase for types/classes; CONST_UPPER for constants if exported; files kebab-case or current names.
- Errors: never swallow; return Result-like objects or throw Error with message; CLI should exit non-zero on failure; log to stderr via src/logger.ts.
- Public APIs: CLI commands in src/cli.ts and LSP actions are the surface; do not break flags or JSON I/O; keep backward compatible.
- Side effects: keep modules pure; only CLI performs I/O; no global state beyond config paths.
- Cursor/Copilot rules: none found (.cursor/ or .github/copilot-instructions.md absent). If added later, mirror here.
