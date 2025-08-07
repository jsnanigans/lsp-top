export const EXIT_CODES = {
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
  NO_PROJECT: 10,
  LSP_ERROR: 11,
  DAEMON_ERROR: 12,
} as const;

export type ExitCodeKey = keyof typeof EXIT_CODES;

export type SchemaVersion = "v1";

export interface CommandResult<T = unknown> {
  schemaVersion: SchemaVersion;
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function result<T>(
  partial: Omit<CommandResult<T>, "schemaVersion">,
): CommandResult<T> {
  return { schemaVersion: "v1", ...partial };
}

export function printJsonAndExit<T>(
  res: CommandResult<T>,
  code: ExitCodeKey = "OK",
) {
  const exit = res.ok
    ? EXIT_CODES.OK
    : (EXIT_CODES[code] ?? EXIT_CODES.GENERAL_ERROR);
  process.stdout.write(JSON.stringify(res) + "\n");
  process.exit(exit);
}

export function printTextAndExit(
  text: string,
  isError = false,
  code: ExitCodeKey = "OK",
) {
  const exit = isError
    ? (EXIT_CODES[code] ?? EXIT_CODES.GENERAL_ERROR)
    : EXIT_CODES.OK;
  (isError ? process.stderr : process.stdout).write(text + "\n");
  process.exit(exit);
}

export function exitNoResultJson<T>(data?: T) {
  printJsonAndExit(
    result({ ok: false, data, code: "NO_RESULT", error: "no-result" }),
    "NO_RESULT",
  );
}

export function exitNoResultText(msg = "No result") {
  printTextAndExit(msg, true, "NO_RESULT");
}
