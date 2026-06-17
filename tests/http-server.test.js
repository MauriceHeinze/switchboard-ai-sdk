import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createSwitchboardServer } from "../dist/server/http.js";
import { providerRegistry } from "../dist/providers/index.js";

const ORIGINAL_CODEX_PROVIDER = providerRegistry.codex;

function createUrl(server, path) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected server to be listening on an address.");
  }

  return `http://127.0.0.1:${address.port}${path}`;
}

async function startServer(overrides = {}) {
  providerRegistry.codex = {
    async discover() {
      return {
        id: "codex",
        name: "Codex",
        type: "agent",
        available: true,
        version: "1.2.3",
        capabilities: ["agent-task", "health-check"],
        models: ["gpt-5-codex"],
        defaultModel: "gpt-5-codex"
      };
    },
    async connect(tool) {
      return {
        id: tool.id,
        name: tool.name,
        type: tool.type,
        capabilities: tool.capabilities,
        async health() {
          return true;
        },
        async chat(input) {
          return {
            echoedMessages: input.messages
          };
        }
      };
    },
    ...overrides
  };

  const server = createSwitchboardServer({
    maxTimeoutMs: 50
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return server;
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  providerRegistry.codex = ORIGINAL_CODEX_PROVIDER;
}

test("GET /health returns server liveness without auth", async () => {
  const server = await startServer();

  try {
    const response = await fetch(createUrl(server, "/health"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeMs, "number");
  } finally {
    await stopServer(server);
  }
});

test("GET /discover returns tools", async () => {
  const server = await startServer();

  try {
    const response = await fetch(createUrl(server, "/discover"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.tools.length, 4);
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.name === "Codex" &&
          tool.available === true &&
          !("models" in tool)
      )
    );
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.name === "Ollama" &&
          tool.available === true &&
          Array.isArray(tool.models) &&
          tool.models.includes("qwen3:14b")
      )
    );
  } finally {
    await stopServer(server);
  }
});

test("GET /health/:toolId reports unavailable tools", async () => {
  const server = await startServer({
    async discover() {
      return {
        id: "codex",
        name: "Codex",
        type: "agent",
        available: false,
        capabilities: ["agent-task", "health-check"],
        metadata: {
          reason: "CLI not found."
        }
      };
    }
  });

  try {
    const response = await fetch(createUrl(server, "/health/codex"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "unavailable");
    assert.equal(body.reason, "CLI not found.");
  } finally {
    await stopServer(server);
  }
});

test("POST /chat/:toolId forwards chat calls", async () => {
  const server = await startServer();

  try {
    const response = await fetch(createUrl(server, "/chat/codex"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }]
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.model, "gpt-5-codex");
    assert.deepEqual(body.result, {
      echoedMessages: [{ role: "user", content: "hello" }]
    });
  } finally {
    await stopServer(server);
  }
});

test("POST /chat/:toolId falls back to the default model when the requested model is unavailable", async () => {
  const server = await startServer({
    async connect(tool) {
      return {
        id: tool.id,
        name: tool.name,
        type: tool.type,
        capabilities: tool.capabilities,
        models: tool.models,
        defaultModel: tool.defaultModel,
        async health() {
          return true;
        },
        async chat(input) {
          return {
            echoedMessages: input.messages,
            usedModel: input.model
          };
        }
      };
    }
  });

  try {
    const response = await fetch(createUrl(server, "/chat/codex"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "gpt-5.5"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.model, "gpt-5-codex");
    assert.deepEqual(body.warnings, [
      'Requested model "gpt-5.5" is not available for Codex.',
      'Falling back to default model "gpt-5-codex".'
    ]);
    assert.deepEqual(body.result, {
      echoedMessages: [{ role: "user", content: "hello" }],
      usedModel: "gpt-5-codex"
    });
  } finally {
    await stopServer(server);
  }
});

test("POST /chat/:toolId returns timeout errors", async () => {
  const server = await startServer({
    async connect(tool) {
      return {
        id: tool.id,
        name: tool.name,
        type: tool.type,
        capabilities: tool.capabilities,
        async health() {
          return true;
        },
        async chat() {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "late";
        }
      };
    }
  });

  try {
    const response = await fetch(createUrl(server, "/chat/codex"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        timeoutMs: 10
      })
    });
    const body = await response.json();

    assert.equal(response.status, 504);
    assert.equal(body.error.code, "timeout");
  } finally {
    await stopServer(server);
  }
});

test("POST /chat/:toolId validates the request body", async () => {
  const server = await startServer();

  try {
    const response = await fetch(createUrl(server, "/chat/codex"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeoutMs: 10
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "invalid_request");
  } finally {
    await stopServer(server);
  }
});
