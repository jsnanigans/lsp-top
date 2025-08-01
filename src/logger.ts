
let isVerbose = false;

export function setVerbose(enabled: boolean) {
  isVerbose = enabled;
}

export function log(message: string, ...args: any[]) {
  if (isVerbose) {
    console.log(message, ...args);
  }
}
