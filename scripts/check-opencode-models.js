import assert from "node:assert/strict";
import { startSwitchboardServer } from "../dist/index.js";

const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);

async function main() {
  const server = await startSwitchboardServer({ maxTimeoutMs: timeoutMs });
  const { url } = server;

  try {
    const response = await fetch(`${url}/discover`);
    assert.equal(response.status, 200, "/discover must return HTTP 200.");

    const body = await response.json();
    assert.ok(Array.isArray(body?.tools), "/discover must return a tools array.");

    const opencode = body.tools.find((tool) => tool.name === "OpenCode");
    assert.ok(opencode, "OpenCode must be present in /discover.");
    assert.ok(opencode.available, "OpenCode must be available.");
    assert.ok(
      Array.isArray(opencode.models),
      "OpenCode discover response must include a models array."
    );

    console.log("OpenCode models");
    console.log(JSON.stringify(opencode.models, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error("check-opencode-models: FAILED");
  console.error(error);
  process.exitCode = 1;
});
