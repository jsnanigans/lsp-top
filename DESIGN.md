# LSP-Top CLI Design

Purpose: a compact, powerful CLI to navigate, debug, and edit TypeScript projects via LSP. It layers ergonomic commands over raw LSP methods, with JSON-first automation and human-friendly defaults.

Guiding principles
- Small surface: a handful of verbs cover 90% use
- Consistent shapes: positions (file:line:col), ranges (A:B or L1:C1-L2:C2)
- Idempotent reads; explicit writes: `--dry` required to preview edits; writing needs `--write` or lack of `--dry`
- Scriptable: `--json` everywhere, stable schemas
- Fast feedback: persistent daemon, batched LSP, low chatter

Top-level command groups
- inspect, jump, search, info, refactor, edit, graph, daemon, project, config

Global conventions
- Options: -v, -q, --json, --log-level <level>, --trace <flags>
- Position: file.ts:line:col (1-based); Range: A:B or L1:C1-L2:C2
- Output: text default; JSON via --json; exit codes 0 ok, 2 no-result, 1 error
- Project context: via alias or cwd autodetect; file args resolve relative to alias root

inspect
- file <path> [--range A:B] [--fix|--fix-dry] [--organize-imports] [--format] [--json]
  - Runs diagnostics; if --fix/--fix-dry, queries quick-fixes and code actions, optionally applies; organize imports and format can be chained
  - JSON schema: { ok, diagnostics: [...], fixes: [...], applied: boolean, edits?: WorkspaceEdit }
- changed [--staged|--since <rev>] [--fix|--fix-dry] [--organize-imports] [--format] [--summary|--json]
  - Applies the same pipeline over a file set (git integration); summary aggregates errors/fixes
- diag <path> [--json]
  - Thin wrapper for plain diagnostics
- health [--json]
  - Checks server availability, tsconfig parsing, project graph, plugin status

jump
- def <path:line:col>
- type <path:line:col>
- impl <path:line:col>
- refs <path:line:col> [--include decl|read|write|all] [--limit N]
- sym <query> [--scope file|workspace] [--kind <kinds>] [--limit N]
  - Output: list of locations with file, range, preview text; JSON includes LSP Location[]

search
- text <pattern> [--glob <g>] [--ignore <g>] [--json]
- symbol <query> [--workspace|--file <path>] [--kind <k>] [--limit N]
  - text uses ripgrep; symbol uses LSP workspace/documentSymbols

info
- hover <path:line:col>
- sig <path:line:col>
- hints <path> [--range A:B]
- semtok <path> [--range A:B] [--legend]
- doc <symbol|path:line:col>
  - For dev-mode debugging: dumps semantic tokens, inlay hints, and symbol docs

refactor
- rename <path:line:col> <newName> [--dry] [--json]
- codeaction <path> [--range A:B|--diag-id <id>] [--list|--apply <index>|--apply-all] [--dry]
- organize-imports <path|--changed>
- extract <function|constant> <path:range> [--name <name>] [--dry]
- format <path|--changed> [--range A:B] [--write|--check]
  - All editing commands prefer to return WorkspaceEdit; application requires confirmation unless explicitly asked

edit
- apply <edits.json> [--dry] [--json]
  - Applies LSP WorkspaceEdit from file/stdin; supports VS Code change schema and tsserver change set
- plan <path> [--from <rev>] [--to <rev>] [--json]
  - Produces a WorkspaceEdit plan from diffs or suggested changes

graph
- calls in|out <path:line:col> [--depth N]
- deps file <path> [--json]
- deps module <name> [--json]
- symbols file <path> | workspace [--kind <k>] [--tree]
  - TS-project graph integration for dependencies; call hierarchy via LSP

daemon
- start [--log-level L] [--trace flags]
- stop
- status [--json]
- logs [--tail N] [--follow]
  - Uses /tmp/lsp-top.sock and /tmp/lsp-top.log; PID at /tmp/lsp-top.pid

project
- init <alias> [path]
- run <alias> -- <subcommand...>
- list
- remove <alias>
- diagnose [alias] [--json]
  - Aliases stored at ~/.lsp-top/aliases.json; run proxies subcommands with alias context

config
- set alias <alias:path>
- print [--env KEYS] [--json]

JSON schemas (selected)
- Location: { uri, range: { start: { line, character }, end: { line, character } }, preview?: string }
- Diagnostic: { severity, code, message, range, source?, relatedInformation? }
- WorkspaceEdit: { documentChanges?: [...], changes?: { [uri]: TextEdit[] } }
- CommandResult envelope: { ok: boolean, code?: string, data?: any, message?: string }

Exit codes
- 0 success
- 2 no-result (e.g., symbol not found, no diagnostics)
- 1 error (invalid args, server error, IO)

Implementation notes
- Parser: commander; preserve current option names for backward compatibility
- Transport: JSON per line over unix socket; each response is one JSON line
- Logging: structured; verbose streams back via {type:"log"}
- File resolution: resolve relative paths from alias root; keep absolute as-is
- Git integration for changed/staged files; fall back to project glob if git absent
- WorkspaceEdit application: atomic per-file; write-to-disk only when requested; handle BOM and newline consistency
- Performance: cache open/close of documents; debounce diagnostics on batch ops
- Safety: never execute code-actions that run commands; only apply pure edits

CLI UX patterns
- List outputs align columns and include source snippets where helpful
- When multiple locations, show top N with `--limit`; suggest `--json` for full data
- TTY detection: richer formatting when interactive; plain when piped

Examples
- lsp-top inspect file src/index.ts --fix-dry --organize-imports --format --json
- lsp-top jump refs src/foo.ts:12:3 --include write --limit 50
- lsp-top refactor rename src/util.ts:7:10 newName --dry
- lsp-top graph calls out src/service.ts:30:5 --depth 2

Open questions
- How to unify organize-imports and format across non-TS servers?
- Policy for ambiguous code actions selection in non-interactive mode
- Handling large WorkspaceEdits (thousands of changes)

RFC
- Background: Developers need a compact CLI to query and manipulate TS code using LSP with minimal ceremony. Existing editors provide UIs; we provide a scriptable shell interface.
- Proposal: Introduce grouped verbs (inspect, jump, search, info, refactor, edit, graph) mapping to high-value workstreams rather than raw LSP calls. Maintain JSON envelopes and preview-first editing.
- Alternatives: Expose raw LSP methods 1:1; create many granular commands. Rejected for verbosity and discoverability issues.
- Compatibility: Backward-compatible with existing `run` usage by hosting new verbs under daemon; `run` remains for power-users.
- Security: Do not execute command-type actions; only apply textual edits. No network access beyond local daemon.
- Migration: Implement groups incrementally; retain current diagnostics/definition as aliases under new verbs.
- Success metrics: p50 latency < 200ms for common queries; < 1 command per task for typical flows; JSON outputs consumed by CI and scripts.
