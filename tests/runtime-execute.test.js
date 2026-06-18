import test from "node:test";
import assert from "node:assert/strict";
import { spawnInteractiveCommand } from "../dist/runtime/execute.js";

test("spawnInteractiveCommand can leave a process running after capture", async () => {
  const { stdout, exitCode } = await spawnInteractiveCommand(
    process.execPath,
    [
      "-e",
      "console.log(process.pid); setInterval(() => {}, 10_000);"
    ],
    {
      captureWindowMs: 200,
      keepRunning: true
    }
  );

  const pid = Number.parseInt(stdout.trim(), 10);

  assert.equal(Number.isInteger(pid), true);
  assert.equal(exitCode, null);

  try {
    process.kill(pid, 0);
  } finally {
    process.kill(pid, "SIGTERM");
  }
});
