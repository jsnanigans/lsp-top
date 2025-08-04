# CRUSH GUIDE

Build/lint/test
- Install: pnpm install
- Build (typecheck): pnpm run build
- Dev entry: pnpm run dev -- <args>
- No linter configured (do not add eslint/prettier)
- Tests (root): none configured; use test-project
- Tests (test-project): pnpm --filter test-project test
- Single test (jest in test-project): pnpm --filter test-project jest path/to/test.ts -t "test name"

Project structure
- Root package is a CLI (bin: dist/cli.js); source in src/*; outDir dist/
- Example app in test-project/* with Jest tests

Code style
- Language/TSConfig: strict true; target ES2020; commonjs; esModuleInterop; resolveJsonModule
- Imports: use relative paths within src; prefer named imports; default only when package exports default
- Formatting: 2 spaces; keep existing style; no trailing comments; avoid unused exports; no comments unless requested
- Types: no any; narrow types; define shared types in src/ or types/; reuse existing types; prefer interfaces for shapes
- Naming: camelCase for vars/functions; PascalCase for types/classes; CONST_UPPER for exported constants; keep current file names
- Errors: never swallow; throw Error with clear message or return Result-like objects; CLI must exit non-zero on failure; log to stderr via src/logger.ts
- Side effects: keep modules pure; only CLI performs I/O; avoid global state beyond config paths
- Public API surface: CLI commands (src/cli.ts) and LSP actions; do not break flags or JSON I/O; maintain backward compatibility

Tools/conventions
- Package manager: pnpm (packageManager pinned)
- Do not introduce new frameworks or linting without approval
- If Cursor/Copilot rules appear later (.cursor/rules or .cursorrules or .github/copilot-instructions.md), mirror them here
