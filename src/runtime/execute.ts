import { execFile, spawn } from "node:child_process";
import { TimeoutError } from "../errors/errors.js";

export type ExecuteCommandOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type SpawnInteractiveCommandOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
  captureWindowMs?: number;
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

          if (typeof error === "object" && error !== null) {
            Object.assign(error, {
              stdout: stdout.trim(),
              stderr: stderr.trim()
            });
          }

          reject(timedOut ? new TimeoutError() : error);
          return;
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      }
    );

    child.stdin?.end();

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

export async function spawnInteractiveCommand(
  command: string,
  args: string[] = [],
  options: SpawnInteractiveCommandOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const captureWindowMs = options.captureWindowMs ?? 1_500;

  return new Promise((resolve, reject) => {
    let settled = false;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let exitCode: number | null = null;

    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const cleanup = () => {
      if (options.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      clearTimeout(captureTimer);
      clearTimeout(timeoutTimer);
    };

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (!child.killed) {
        child.kill();
      }

      resolve({
        stdout: stdoutChunks.join("").trim(),
        stderr: stderrChunks.join("").trim(),
        exitCode
      });
    };

    const abortHandler = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      child.kill();
      reject(new TimeoutError());
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });

    child.once("exit", (code) => {
      exitCode = code;
      finish();
    });

    child.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    });

    const captureTimer = setTimeout(() => {
      finish();
    }, captureWindowMs);

    const timeoutTimer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            abortHandler();
          }, options.timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        abortHandler();
        return;
      }

      options.signal.addEventListener("abort", abortHandler, { once: true });
    }
  });
}
