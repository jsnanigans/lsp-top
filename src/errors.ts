export const EXIT_CODES = {
  OK: 0,
  GENERAL_ERROR: 1,
  ALIAS_NOT_FOUND: 2,
  DAEMON_UNAVAILABLE: 3,
  STATUS_ERROR: 4,
  DAEMON_NOT_RUNNING: 5,
  BAD_FLAG: 6,
  CONFIG_SET_ERROR: 7,
  DIAGNOSE_FAILED: 8
} as const;

export type ExitCodeKey = keyof typeof EXIT_CODES;

export interface CliResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function printJsonAndExit<T>(res: CliResult<T>, code: ExitCodeKey = 'OK') {
  const exit = res.ok ? EXIT_CODES.OK : EXIT_CODES[code] ?? EXIT_CODES.GENERAL_ERROR;
  process.stdout.write(JSON.stringify(res) + '\n');
  process.exit(exit);
}

export function printTextAndExit(text: string, isError = false, code: ExitCodeKey = 'OK') {
  const exit = isError ? EXIT_CODES[code] ?? EXIT_CODES.GENERAL_ERROR : EXIT_CODES.OK;
  (isError ? process.stderr : process.stdout).write(text + '\n');
  process.exit(exit);
}
