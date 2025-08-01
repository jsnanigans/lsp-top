import * as fs from 'fs';
import { EventEmitter } from 'events';

const LOG_FILE = '/tmp/lsp-top.log';
const loggerEmitter = new EventEmitter();
let isVerbose = false;

// Set up a persistent listener to write to the physical log file
loggerEmitter.on('log', (message: string) => {
  fs.appendFileSync(LOG_FILE, message + '\n');
});

function setVerbose(enabled: boolean) {
  isVerbose = enabled;
}

function log(message: string, ...args: any[]) {
  if (isVerbose) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} - ${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`;
    loggerEmitter.emit('log', formattedMessage);
  }
}

function clearLogFile() {
    fs.writeFileSync(LOG_FILE, '');
}

export {
    loggerEmitter,
    log,
    setVerbose,
    clearLogFile
};
