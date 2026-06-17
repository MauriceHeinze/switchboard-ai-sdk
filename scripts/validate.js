import assert from "node:assert/strict";
import { startSwitchboardServer } from "../dist/index.js";

const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);
const prompt = "Reply with a short list of 5 ideas.";
const knownProviderIds = ["claude-code", "codex", "ollama", "opencode"];
const unavailableModel = "switchboard-this-model-should-not-exist";

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
  const { url } = server;

  async function request(path, options = {}) {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
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
    const serverHealth = await request("/health");
    assert.equal(serverHealth.status, 200, "/health must return HTTP 200.");
    assert.equal(serverHealth.body?.status, "ok");
    assert.equal(typeof serverHealth.body?.uptimeMs, "number");
    logStep("health", serverHealth.body);

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

    const unknownTool = await request("/health/not-a-tool");
    assert.equal(unknownTool.status, 404, "/health/not-a-tool must return HTTP 404.");
    assert.equal(unknownTool.body?.error?.code, "tool_not_found");
    logStep("health/not-a-tool", unknownTool.body);

    const invalidChat = await request(
      "/chat/codex",
      createPost({ prompt, timeoutMs })
    );
    assert.equal(invalidChat.status, 400, "/chat/codex must reject prompt-only payloads.");
    assert.equal(invalidChat.body?.error?.code, "invalid_request");
    logStep("chat/codex invalid-request", invalidChat.body);

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

      const codexFallback = await request(
        "/chat/codex",
        createPost({
          messages: [{ role: "user", content: prompt }],
          model: unavailableModel,
          timeoutMs
        })
      );
      assert.equal(codexFallback.status, 200, "/chat/codex must support model fallback when Codex is available.");
      assert.equal(codexFallback.body?.toolId, "codex");
      assert.ok(Array.isArray(codexFallback.body?.warnings), "Fallback response must include warnings.");
      assert.equal(typeof codexFallback.body?.result?.message?.content, "string");
      logStep("chat/codex fallback", codexFallback.body);
    } else {
      console.log("\nchat/codex\nSkipped because Codex is unavailable.");
    }

    if (availabilityByName.get("OpenCode")) {
      const opencodeCall = await request(
        "/chat/opencode",
        createPost({ messages: [{ role: "user", content: prompt }], timeoutMs })
      );
      assert.equal(opencodeCall.status, 200, "/chat/opencode must return HTTP 200 when OpenCode is available.");
      assert.equal(opencodeCall.body?.toolId, "opencode");
      assert.equal(opencodeCall.body?.type, "agent");
      assert.equal(typeof opencodeCall.body?.latencyMs, "number");
      assert.equal(typeof opencodeCall.body?.result?.message?.content, "string");

      logStep("chat/opencode", opencodeCall.body);

      const opencodeFallback = await request(
        "/chat/opencode",
        createPost({
          messages: [{ role: "user", content: prompt }],
          model: unavailableModel,
          timeoutMs
        })
      );
      assert.equal(
        opencodeFallback.status,
        200,
        "/chat/opencode must support model fallback when OpenCode is available."
      );
      assert.equal(opencodeFallback.body?.toolId, "opencode");
      assert.ok(
        Array.isArray(opencodeFallback.body?.warnings),
        "Fallback response must include warnings."
      );
      assert.equal(typeof opencodeFallback.body?.result?.message?.content, "string");
      logStep("chat/opencode fallback", opencodeFallback.body);
    } else {
      console.log("\nchat/opencode\nSkipped because OpenCode is unavailable.");
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

      const ollamaInvalidMessages = await request(
        "/chat/ollama",
        createPost({
          messages: [{ role: "tool", content: prompt }],
          timeoutMs
        })
      );
      assert.equal(ollamaInvalidMessages.status, 400, "/chat/ollama must reject invalid message roles.");
      assert.equal(ollamaInvalidMessages.body?.error?.code, "invalid_request");
      logStep("chat/ollama invalid-messages", ollamaInvalidMessages.body);
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
