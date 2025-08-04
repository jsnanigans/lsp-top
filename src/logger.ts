import * as fs from 'fs';
import { EventEmitter } from 'events';

const LOG_FILE = '/tmp/lsp-top.log';
const MAX_SIZE_BYTES = 1024 * 1024;
const loggerEmitter = new EventEmitter();
export type Level = 'error' | 'warn' | 'info' | 'debug' | 'trace';
let level: Level = 'info';
let traceFlags: Set<string> = new Set();

loggerEmitter.on('log', (message: string) => {
  fs.appendFileSync(LOG_FILE, message + '\n');
});

function rotateIfNeeded() {
  try {
    const stat = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
    if (stat && stat.size > MAX_SIZE_BYTES) {
      const backup = LOG_FILE + '.1';
      try { fs.unlinkSync(backup); } catch {}
      fs.renameSync(LOG_FILE, backup);
    }
  } catch {}
}

function setLogLevel(l: Level) { level = l; }
function setTraceFlags(flags: string[]) { traceFlags = new Set(flags); }

function shouldLog(l: Level, flag?: string) {
  const order: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
  if (flag && !traceFlags.has(flag)) return false;
  return order[l] <= order[level];
}

function log(l: Level, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(l, meta && typeof meta.flag === 'string' ? String(meta.flag) : undefined)) return;
  const entry = {
    ts: new Date().toISOString(),
    level: l,
    msg: message,
    ...(meta || {})
  };
  rotateIfNeeded();
  loggerEmitter.emit('log', JSON.stringify(entry));
}

function clearLogFile() {
    fs.writeFileSync(LOG_FILE, '');
}

class Metrics {
  private counters = new Map<string, number>();
  private hist = new Map<string, number[]>();

  inc(name: string, value = 1) {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  observe(name: string, ms: number) {
    const arr = this.hist.get(name) || [];
    arr.push(ms);
    this.hist.set(name, arr);
  }

  snapshot() {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    const durations: Record<string, { count: number; p50: number; p95: number; max: number }> = {};
    for (const [k, arr] of this.hist) {
      const sorted = [...arr].sort((a, b) => a - b);
      const n = sorted.length;
      const pct = (p: number) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))];
      durations[k] = { count: n, p50: pct(0.5) || 0, p95: pct(0.95) || 0, max: sorted[n - 1] || 0 };
    }
    return { counters, durations };
  }
}

const metrics = new Metrics();

function time<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  metrics.inc(`${name}.calls`);
  return fn().then((res) => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    metrics.observe(`${name}.duration_ms`, ms);
    return res;
  }, (err) => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    metrics.observe(`${name}.duration_ms`, ms);
    metrics.inc(`${name}.errors`);
    throw err;
  });
}

export {
    loggerEmitter,
    log,
    setLogLevel,
    setTraceFlags,
    clearLogFile,
    LOG_FILE,
    metrics,
    time
};
