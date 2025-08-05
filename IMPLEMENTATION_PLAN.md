# LSP-Top Implementation Plan (v1)

## Phase 1: Baseline and Schemas
- Add `schemaVersion` to all JSON envelopes; define shared types in `src/errors.ts` and result envelopes in `src/*`.
- Ensure CLI global flags match DESIGN; extend `src/cli.ts` parsing; keep backward-compatible aliases.
- Add exit code 2 path for "no-result"; audit commands to return `CommandResult` consistently.

## Phase 2: Inspect Pipeline
- Implement `inspect file`/`inspect changed` with `--fix/--fix-dry`, `--organize-imports`, `--format` in `src/cli.ts` → `src/lsp-client.ts`.
- Return diagnostics, candidate fixes, and `WorkspaceEdit`; only apply with `--write`.
- Add git integration for changed/staged in `src/path-utils.ts`.

## Phase 3: Edit Semantics
- Implement `edit apply`/`edit plan` in `src/cli.ts`.
- Apply edits atomically per-file; preserve `documentChanges` order; rollback file on partial failure.
- Deterministic conflict detection; surface conflicts with exit 2.

## Phase 4: Jump, Search, Info
- Map `def`/`type`/`impl`/`refs`/`sym`; text search via ripgrep; symbols via LSP.
- Provide consistent `Location` previews; support `--limit` and `--json`.

## Phase 5: Refactors
- Implement `rename`, `codeaction` list/apply, `extract`, `organize-imports`, `format` with `--dry/--write`.
- Enforce snapshot consistency for multi-file edits; fail deterministically on drift.

## Phase 6: Daemon and Performance
- Add `--trace` presets; measure latency histograms; expose daemon status with queue depth and cache hits.
- Enforce single-writer on unix socket; invalidate caches on git checkout/branch/tsconfig changes.

## Phase 7: Security and Paths
- Normalize/validate URIs; restrict operations to project root.
- Reject path traversal; never execute command-type actions.

## Phase 8: UX and Help
- Improve `--help` with copy-pastable transcripts and column-aligned outputs.
- Default `inspect` output shows actionable fixes with safe apply affordances.

## Phase 9: Project and Config
- Implement alias store at `~/.lsp-top/aliases.json`.
- Implement `project run/diagnose` and `config print/set alias`.

## Phase 10: Tests and Examples
- Add `test-project` workflows covering inspect/jump/refactor/edit apply/rollback.
- Ensure `--json` outputs round-trip into `edit apply` without modification.

## Milestones
- v1.0: inspect file/changed, jump def/refs, rename, edit apply, daemon status, schemaVersion.
- v1.1: extract, graph calls/deps, trace presets, git-aware cache invalidation.
- v1.2: live health metrics, plan generator, advanced format/organize-imports across servers.
