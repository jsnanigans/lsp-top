import * as path from "path";

export function resolveProjectPath(
  projectRoot: string,
  filePath: string,
): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(projectRoot, filePath);
}

export function makeRelativeToProject(
  projectRoot: string,
  absolutePath: string,
): string {
  return path.relative(projectRoot, absolutePath);
}

export async function gitChangedFiles(
  projectRoot: string,
  opts: { staged?: boolean } = {},
): Promise<string[]> {
  const { spawn } = await import("child_process");
  const args = ["git", "diff", "--name-only"];
  if (opts.staged) args.push("--cached");
  return await new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    proc.stdout?.on("data", (d) => {
      out += String(d);
    });
    proc.on("close", () => {
      resolve(
        out
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((p) => path.join(projectRoot, p)),
      );
    });
  });
}
