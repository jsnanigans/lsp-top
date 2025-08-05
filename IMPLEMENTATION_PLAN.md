# LSP-Top Implementation Plan (v1)
based on the design document and RFC ./DESIGN.md

## Phase 1: Baseline and Schemas ✓ Mostly Complete
- [x] Add `schemaVersion` to all JSON envelopes; define shared types in `src/errors.ts` and result envelopes in `src/*`.
  - ✅ `schemaVersion: "v1"` implemented in `src/errors.ts`
  - ✅ `CommandResult<T>` interface with `result()` helper function
  - ✅ Used in all JSON outputs via `printJsonAndExit()`
- [x] Ensure CLI global flags match DESIGN; extend `src/cli.ts` parsing; keep backward-compatible aliases.
  - ✅ Global flags: `--json`, `--verbose`, `--quiet`, `--log-level`, `--trace`
  - ✅ Properly propagated to all commands
- [x] Add exit code 2 path for "no-result"; audit commands to return `CommandResult` consistently.
  - ✅ `EXIT_CODES.NO_RESULT = 2` defined
  - ✅ Helper functions: `exitNoResultJson()` and `exitNoResultText()`
  - ⚠️ Need to verify all commands use consistent exit codes

## Phase 2: Inspect Pipeline ✓ Complete
- [x] Implement `inspect file`/`inspect changed` with `--fix/--fix-dry`, `--organize-imports`, `--format` in `src/cli.ts` → `src/lsp-client.ts`.
  - ✅ Commands: `inspect <alias> file <path>` and `inspect <alias> changed`
  - ✅ All flags implemented and working: `--fix`, `--fix-dry`, `--organize-imports`, `--format`, `--write`
  - ✅ Properly routes through daemon to TypeScript LSP
- [x] Return diagnostics, candidate fixes, and `WorkspaceEdit`; only apply with `--write`.
  - ✅ Returns diagnostics array and WorkspaceEdit structure
  - ✅ Only applies changes when `--write` flag is present
- [x] Add git integration for changed/staged in `src/path-utils.ts`.
  - ✅ `gitChangedFiles()` function with `--staged` support
  - ✅ Uses `git diff --name-only [--cached]`

## Phase 3: Edit Semantics ✓ Complete
- [x] Implement `edit apply`/`edit plan` in `src/cli.ts`.
  - ✅ Commands: `edit <alias> apply [input]` and `edit <alias> plan [input]`
  - ✅ Accepts WorkspaceEdit JSON from stdin or file
  - ✅ Routes through daemon for processing
- [~] Apply edits atomically per-file; preserve `documentChanges` order; rollback file on partial failure.
  - ✅ Basic apply functionality exists
  - ⚠️ Atomic operations and rollback not fully verified in implementation
- [~] Deterministic conflict detection; surface conflicts with exit 2.
  - ⚠️ Conflict detection logic not clearly visible in code

## Phase 4: Jump, Search, Info ⚠ Minimal
- [~] Map `def`/`type`/`impl`/`refs`/`sym`; text search via ripgrep; symbols via LSP.
  - [x] `definition` command implemented in daemon.ts
    - ✅ Accepts format: `file.ts:line:column`
    - ✅ Returns LSP definition locations
  - [ ] `type`, `impl`, `refs`, `sym` commands missing
  - [ ] Text search integration missing
  - [ ] No ripgrep integration for text search
- [ ] Provide consistent `Location` previews; support `--limit` and `--json`.
  - ❌ No preview functionality
  - ❌ No `--limit` support implemented

## Phase 5: Refactors ⚠ Partial
- [~] Implement `rename`, `codeaction` list/apply, `extract`, `organize-imports`, `format` with `--dry/--write`.
  - [x] `organize-imports` and `format` via inspect command
    - ✅ `--organize-imports` flag in inspect command
    - ✅ `--format` flag in inspect command
    - ✅ Uses TypeScript LSP's `_typescript.organizeImports` command
    - ✅ Uses `textDocument/formatting` LSP method
  - [ ] Standalone `rename`, `codeaction`, `extract` commands missing
  - [ ] No dedicated refactor command structure
- [ ] Enforce snapshot consistency for multi-file edits; fail deterministically on drift.
  - ❌ No snapshot consistency checks
  - ❌ No drift detection

## Phase 6: Daemon and Performance ✓ Complete
- [x] Add `--trace` presets; measure latency histograms; expose daemon status with queue depth and cache hits.
  - ✅ `--trace` flag implemented throughout CLI
  - ✅ Metrics class with counters and histograms (p50/p95/max)
  - ✅ `time()` function wraps async operations for measurement
  - ✅ `metrics` command shows daemon status with session count
  - ✅ Trace flags control conditional logging
- [ ] Enforce single-writer on unix socket; invalidate caches on git checkout/branch/tsconfig changes.
  - ❌ No single-writer enforcement
  - ❌ No git-aware cache invalidation

## Phase 7: Security and Paths ⚠ Partial
- [x] Normalize/validate URIs; restrict operations to project root.
  - ✅ `resolveProjectPath()` function for path resolution
  - ✅ `makeRelativeToProject()` for relative paths
  - ✅ All file operations use resolved paths
- [ ] Reject path traversal; never execute command-type actions.
  - ⚠️ No explicit path traversal checks (e.g., checking for `../`)
  - ⚠️ No validation against escaping project root
  - ✅ No command execution in codebase

## Phase 8: UX and Help ⚠ Minimal
- [ ] Improve `--help` with copy-pastable transcripts and column-aligned outputs.
  - ✅ Basic help exists via Commander.js
  - ❌ No copy-pastable example transcripts
  - ❌ No column-aligned formatting
- [~] Default `inspect` output shows actionable fixes with safe apply affordances.
  - ✅ Shows diagnostics and fixes
  - ⚠️ Output format could be more user-friendly

## Phase 9: Project and Config ❌ Not Started
- [ ] Implement alias store at `~/.lsp-top/aliases.json`.
  - ❌ Currently stores in `~/.config/lsp-top/config.json`
  - ❌ No separate aliases.json file
- [ ] Implement `project run/diagnose` and `config print/set alias`.
  - ✅ Basic `configure --set-alias` exists
  - ✅ `diagnose [alias]` command exists
  - ❌ No `project run` command
  - ❌ No dedicated `config` subcommands

## Current Status Summary
- **Core Infrastructure**: ✅ Daemon, LSP client, CLI framework, and schemaVersion fully implemented
- **Inspect**: ✅ Complete implementation with diagnostics, fixes, format, and organize imports
- **Edit**: ✅ Apply/plan functionality implemented, atomic operations partially verified
- **Jump/Search**: ❌ Only `definition` implemented; missing type/refs/impl/sym
- **Refactors**: ⚠️ Format/organize via inspect; missing standalone rename/codeaction/extract
- **Testing**: ✅ Good test coverage with test-project examples

## Priority Items for v1.0
1. ✅ ~~Complete schemaVersion implementation across all JSON outputs~~
2. ✅ ~~Finish inspect pipeline with proper fix application~~
3. Complete edit apply atomic operations and rollback verification
4. Implement missing jump commands (type, refs, impl, sym)
5. Add standalone refactor commands (rename, codeaction, extract)

## Milestones
- v1.0: inspect file/changed, jump def/refs, rename, edit apply, daemon status, schemaVersion.
- v1.1: extract, graph calls/deps, trace presets, git-aware cache invalidation.
- v1.2: live health metrics, plan generator, advanced format/organize-imports across servers.

## Key Implementation Gaps
1. **Jump Commands**: Only `definition` exists; need `type`, `refs`, `impl`, `sym`
2. **Refactor Commands**: Missing standalone `rename`, `codeaction list/apply`, `extract`
3. **Project Management**: No ~/.lsp-top/aliases.json or project commands
4. **Security**: Path traversal protection incomplete
5. **Cache Invalidation**: Git-aware cache invalidation not implemented
6. **UX**: Help system needs copy-pastable examples

## Legend
- [x] Complete
- [~] Partial/In Progress
- [ ] Not Started
- ✓ Phase has significant progress
- ⚠ Phase has minimal progress
- ❌ Phase not started
