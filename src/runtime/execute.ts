import { execFile } from "node:child_process";
import { TimeoutError } from "../errors/errors.js";

export type ExecuteCommandOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecuteCommandOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(
      command,
      args,
      {
        encoding: "utf8",
        timeout: options.timeoutMs
      },
      (error, stdout, stderr) => {
        if (settled) {
          return;
        }

        settled = true;

        if (options.signal) {
          options.signal.removeEventListener("abort", abortHandler);
        }

        if (error) {
          const timedOut =
            "killed" in error && error.killed && options.timeoutMs !== undefined;

          reject(timedOut ? new TimeoutError() : error);
          return;
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      }
    );

    const abortHandler = () => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new TimeoutError());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        abortHandler();
        return;
      }

      options.signal.addEventListener("abort", abortHandler, { once: true });
    }

    child.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;

      if (options.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }

      reject(error);
    });
  });
}
