"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setVerbose = setVerbose;
exports.log = log;
let isVerbose = false;
function setVerbose(enabled) {
    isVerbose = enabled;
}
function log(message, ...args) {
    if (isVerbose) {
        console.log(message, ...args);
    }
}
