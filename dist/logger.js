"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.LOG_FILE = exports.loggerEmitter = void 0;
exports.log = log;
exports.setLogLevel = setLogLevel;
exports.setTraceFlags = setTraceFlags;
exports.clearLogFile = clearLogFile;
exports.time = time;
const fs = __importStar(require("fs"));
const events_1 = require("events");
const LOG_FILE = '/tmp/lsp-top.log';
exports.LOG_FILE = LOG_FILE;
const MAX_SIZE_BYTES = 1024 * 1024;
const loggerEmitter = new events_1.EventEmitter();
exports.loggerEmitter = loggerEmitter;
let level = 'info';
let traceFlags = new Set();
loggerEmitter.on('log', (message) => {
    fs.appendFileSync(LOG_FILE, message + '\n');
});
function rotateIfNeeded() {
    try {
        const stat = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
        if (stat && stat.size > MAX_SIZE_BYTES) {
            const backup = LOG_FILE + '.1';
            try {
                fs.unlinkSync(backup);
            }
            catch { }
            fs.renameSync(LOG_FILE, backup);
        }
    }
    catch { }
}
function setLogLevel(l) { level = l; }
function setTraceFlags(flags) { traceFlags = new Set(flags); }
function shouldLog(l, flag) {
    const order = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    if (flag && !traceFlags.has(flag))
        return false;
    return order[l] <= order[level];
}
function log(l, message, meta) {
    if (!shouldLog(l, meta && typeof meta.flag === 'string' ? String(meta.flag) : undefined))
        return;
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
    constructor() {
        this.counters = new Map();
        this.hist = new Map();
    }
    inc(name, value = 1) {
        this.counters.set(name, (this.counters.get(name) || 0) + value);
    }
    observe(name, ms) {
        const arr = this.hist.get(name) || [];
        arr.push(ms);
        this.hist.set(name, arr);
    }
    snapshot() {
        const counters = {};
        for (const [k, v] of this.counters)
            counters[k] = v;
        const durations = {};
        for (const [k, arr] of this.hist) {
            const sorted = [...arr].sort((a, b) => a - b);
            const n = sorted.length;
            const pct = (p) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))];
            durations[k] = { count: n, p50: pct(0.5) || 0, p95: pct(0.95) || 0, max: sorted[n - 1] || 0 };
        }
        return { counters, durations };
    }
}
const metrics = new Metrics();
exports.metrics = metrics;
function time(name, fn) {
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
