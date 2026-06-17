import assert from "node:assert/strict";
import { startSwitchboardServer } from "../dist/index.js";

const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);
const prompt = "Reply with exactly OK.";
const knownProviderIds = ["claude-code", "codex", "ollama", "opencode"];

function logStep(label, details) {
  console.log(`\n${label}`);

  if (details !== undefined) {
    console.log(JSON.stringify(details, null, 2));
  }
}

function assertToolSummary(tool) {
  assert.equal(typeof tool.name, "string");
  assert.equal(typeof tool.available, "boolean");

  if (tool.name === "Ollama") {
    assert.ok(Array.isArray(tool.models), "Ollama discover response must include models.");
  } else {
    assert.equal("models" in tool, false);
  }
}

function createPost(body) {
  return {
    method: "POST",
    body: JSON.stringify(body)
  };
}

async function main() {
  const server = await startSwitchboardServer({ maxTimeoutMs: timeoutMs });
  const { url, token } = server;

  async function request(path, options = {}) {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(options.headers ?? {})
      }
    });

    let body;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      status: response.status,
      body
    };
  }

  try {
    const discover = await request("/discover");
    assert.equal(discover.status, 200, "/discover must return HTTP 200.");
    assert.ok(Array.isArray(discover.body?.tools), "/discover must return a tools array.");

    for (const tool of discover.body.tools) {
      assertToolSummary(tool);
    }

    logStep("discover", discover.body);

    const availabilityByName = new Map(
      discover.body.tools.map((tool) => [tool.name, tool.available])
    );

    for (const providerId of knownProviderIds) {
      const health = await request(`/health/${providerId}?timeoutMs=${timeoutMs}`);
      assert.equal(health.status, 200, `/health/${providerId} must return HTTP 200.`);
      assert.equal(health.body?.toolId, providerId);
      assert.equal(typeof health.body?.status, "string");
      assert.equal(typeof health.body?.available, "boolean");
      assert.equal(typeof health.body?.latencyMs, "number");

      logStep(`health/${providerId}`, health.body);
    }

    if (availabilityByName.get("Codex")) {
      const codexCall = await request(
        "/chat/codex",
        createPost({ messages: [{ role: "user", content: prompt }], timeoutMs })
      );
      assert.equal(codexCall.status, 200, "/chat/codex must return HTTP 200 when Codex is available.");
      assert.equal(codexCall.body?.toolId, "codex");
      assert.equal(codexCall.body?.type, "agent");
      assert.equal(typeof codexCall.body?.latencyMs, "number");
      assert.equal(typeof codexCall.body?.result?.message?.content, "string");

      logStep("chat/codex", codexCall.body);
    } else {
      console.log("\nchat/codex\nSkipped because Codex is unavailable.");
    }

    if (availabilityByName.get("Ollama")) {
      const ollamaCall = await request(
        "/chat/ollama",
        createPost({
          messages: [{ role: "user", content: prompt }],
          timeoutMs
        })
      );
      assert.equal(ollamaCall.status, 200, "/chat/ollama must return HTTP 200 when Ollama is available.");
      assert.equal(ollamaCall.body?.toolId, "ollama");
      assert.equal(ollamaCall.body?.type, "runtime");
      assert.equal(typeof ollamaCall.body?.latencyMs, "number");
      assert.equal(typeof ollamaCall.body?.result?.message?.content, "string");

      logStep("chat/ollama", ollamaCall.body);
    } else {
      console.log("\nchat/ollama\nSkipped because Ollama is unavailable.");
    }

    console.log("\nvalidate: OK");
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error("\nvalidate: FAILED");
  console.error(error);
  process.exitCode = 1;
});
