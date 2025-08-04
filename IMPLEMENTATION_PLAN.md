# CLI Improvement Implementation Plan

## P0
- Help/UX: global --help, per-command help, examples; --version; verbose/debug; consistent errors/exit codes
- Command surface: init, configure, start, status, stop, logs, diagnose; consistent flags; --json
- Config: schema + validation, env var mapping, print effective config
- LSP lifecycle/daemon: single-instance guard, start/stop/restart, health check, PID/log files, graceful shutdown

Status: Config validation/env mapping DONE. Single-instance guard + PID/log files DONE. Standardized exit codes + JSON/text helpers DONE.

## P1
- Observability: structured logs, levels, trace flags, log rotation; timings/metrics
  - Structured logger with levels + rotation DONE
  - CLI flags --log-level/--trace and pass-through to daemon DONE
  - Logs command enhancements: tail/follow, show PID and level DONE
  - Timings/metrics: per-request duration and counters TODO
- Project detection: workspace/multi-root, tsconfig resolution, monorepo awareness
- Testing: e2e CLI tests on fixture projects; golden outputs; self-test command

## P2
- Performance: warm cache, server reuse, debounce, concurrency limits
- Extensibility: plugin hooks for servers/transports/config providers; stable plugin API
- Integration: CI mode, stdio pipe, JSON-RPC bridge; editor helper outputs

## P3
- Distribution: single package/binary, install docs, Node/PNPM pinning
- Security: scrub secrets in logs, safe path handling, sandbox child processes
- Telemetry (opt-in): metrics with consent, disable switch, documented schema
