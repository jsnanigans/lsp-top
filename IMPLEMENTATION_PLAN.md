# LSP-Top Implementation Plan (v1)
based on the design document and RFC ./DESIGN.md

## Phase 1: Baseline and Schemas ✓ Partial
- [ ] Add `schemaVersion` to all JSON envelopes; define shared types in `src/errors.ts` and result envelopes in `src/*`.
- [x] Ensure CLI global flags match DESIGN; extend `src/cli.ts` parsing; keep backward-compatible aliases.
- [~] Add exit code 2 path for "no-result"; audit commands to return `CommandResult` consistently.

## Phase 2: Inspect Pipeline ✓ Partial
- [~] Implement `inspect file`/`inspect changed` with `--fix/--fix-dry`, `--organize-imports`, `--format` in `src/cli.ts` → `src/lsp-client.ts`.
- [~] Return diagnostics, candidate fixes, and `WorkspaceEdit`; only apply with `--write`.
- [x] Add git integration for changed/staged in `src/path-utils.ts`.

## Phase 3: Edit Semantics ✓ Partial
- [~] Implement `edit apply`/`edit plan` in `src/cli.ts`.
- [~] Apply edits atomically per-file; preserve `documentChanges` order; rollback file on partial failure.
- [~] Deterministic conflict detection; surface conflicts with exit 2.

## Phase 4: Jump, Search, Info ⚠ Minimal
- [~] Map `def`/`type`/`impl`/`refs`/`sym`; text search via ripgrep; symbols via LSP.
- [~] Provide consistent `Location` previews; support `--limit` and `--json`.

## Phase 5: Refactors ⚠ Minimal
- [~] Implement `rename`, `codeaction` list/apply, `extract`, `organize-imports`, `format` with `--dry/--write`.
- [ ] Enforce snapshot consistency for multi-file edits; fail deterministically on drift.

## Phase 6: Daemon and Performance ✓ Partial
- [~] Add `--trace` presets; measure latency histograms; expose daemon status with queue depth and cache hits.
- [ ] Enforce single-writer on unix socket; invalidate caches on git checkout/branch/tsconfig changes.

## Phase 7: Security and Paths ✓ Partial
- [~] Normalize/validate URIs; restrict operations to project root.
- [~] Reject path traversal; never execute command-type actions.

## Phase 8: UX and Help ⚠ Minimal
- [ ] Improve `--help` with copy-pastable transcripts and column-aligned outputs.
- [~] Default `inspect` output shows actionable fixes with safe apply affordances.

## Phase 9: Project and Config ⚠ Minimal
- [ ] Implement alias store at `~/.lsp-top/aliases.json`.
- [ ] Implement `project run/diagnose` and `config print/set alias`.

## Phase 10: Tests and Examples ✓ Partial
- [~] Add `test-project` workflows covering inspect/jump/refactor/edit apply/rollback.
- [~] Ensure `--json` outputs round-trip into `edit apply` without modification.

## Current Status Summary
- **Core Infrastructure**: Basic daemon, LSP client, and CLI framework in place
- **Inspect**: Partial implementation with basic diagnostics and fixes
- **Edit**: Basic apply functionality, needs atomic operations and rollback
- **Jump/Search**: Minimal implementation, needs completion
- **Refactors**: Basic rename support, other refactors pending
- **Testing**: Test infrastructure exists, needs comprehensive coverage

## Priority Items for v1.0
1. Complete schemaVersion implementation across all JSON outputs
2. Finish inspect pipeline with proper fix application
3. Complete edit apply with atomic operations and rollback
4. Implement core jump commands (def, refs, type)
5. Add comprehensive test coverage for existing features

## Milestones
- v1.0: inspect file/changed, jump def/refs, rename, edit apply, daemon status, schemaVersion.
- v1.1: extract, graph calls/deps, trace presets, git-aware cache invalidation.
- v1.2: live health metrics, plan generator, advanced format/organize-imports across servers.

## Legend
- [x] Complete
- [~] Partial/In Progress
- [ ] Not Started
- ✓ Phase has significant progress
- ⚠ Phase has minimal progress
