"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_CODES = void 0;
exports.result = result;
exports.printJsonAndExit = printJsonAndExit;
exports.printTextAndExit = printTextAndExit;
exports.exitNoResultJson = exitNoResultJson;
exports.exitNoResultText = exitNoResultText;
exports.EXIT_CODES = {
    OK: 0,
    GENERAL_ERROR: 1,
    NO_RESULT: 2,
    DAEMON_UNAVAILABLE: 3,
    STATUS_ERROR: 4,
    DAEMON_NOT_RUNNING: 5,
    BAD_FLAG: 6,
    CONFIG_SET_ERROR: 7,
    DIAGNOSE_FAILED: 8,
    ALIAS_NOT_FOUND: 9,
};
function result(partial) {
    return { schemaVersion: "v1", ...partial };
}
function printJsonAndExit(res, code = "OK") {
    const exit = res.ok
        ? exports.EXIT_CODES.OK
        : (exports.EXIT_CODES[code] ?? exports.EXIT_CODES.GENERAL_ERROR);
    process.stdout.write(JSON.stringify(res) + "\n");
    process.exit(exit);
}
function printTextAndExit(text, isError = false, code = "OK") {
    const exit = isError
        ? (exports.EXIT_CODES[code] ?? exports.EXIT_CODES.GENERAL_ERROR)
        : exports.EXIT_CODES.OK;
    (isError ? process.stderr : process.stdout).write(text + "\n");
    process.exit(exit);
}
function exitNoResultJson(data) {
    printJsonAndExit(result({ ok: false, data, code: "NO_RESULT", error: "no-result" }), "NO_RESULT");
}
function exitNoResultText(msg = "No result") {
    printTextAndExit(msg, true, "NO_RESULT");
}
