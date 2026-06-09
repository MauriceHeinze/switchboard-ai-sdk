import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function executeCommand(
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(command, args, {
    encoding: "utf8"
  });

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}
