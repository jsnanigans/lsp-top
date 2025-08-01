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
exports.loggerEmitter = void 0;
exports.log = log;
exports.setVerbose = setVerbose;
exports.clearLogFile = clearLogFile;
const fs = __importStar(require("fs"));
const events_1 = require("events");
const LOG_FILE = '/tmp/lsp-top.log';
const loggerEmitter = new events_1.EventEmitter();
exports.loggerEmitter = loggerEmitter;
let isVerbose = false;
// Set up a persistent listener to write to the physical log file
loggerEmitter.on('log', (message) => {
    fs.appendFileSync(LOG_FILE, message + '\n');
});
function setVerbose(enabled) {
    isVerbose = enabled;
}
function log(message, ...args) {
    if (isVerbose) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `${timestamp} - ${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`;
        loggerEmitter.emit('log', formattedMessage);
    }
}
function clearLogFile() {
    fs.writeFileSync(LOG_FILE, '');
}
