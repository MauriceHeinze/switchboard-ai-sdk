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
  let discoverConfig;
  let connectConfig;

  providerRegistry.codex = {
    async discover(config) {
      discoverConfig = config;
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
    async connect(tool, config) {
      connectConfig = config;
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

  return {
    server,
    getDiscoverConfig: () => discoverConfig,
    getConnectConfig: () => connectConfig
  };
}

async function stopServer(serverState) {
  const { server } = serverState;

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
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/health"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeMs, "number");
  } finally {
    await stopServer(serverState);
  }
});

test("GET /discover returns tools", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/discover"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.tools.length, 4);
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.name === "Codex" &&
          tool.available === true &&
          Array.isArray(tool.models) &&
          tool.models.includes("gpt-5-codex")
      )
    );
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.name === "OpenCode" &&
          tool.available === true &&
          Array.isArray(tool.models) &&
          tool.models.includes("openai/gpt-5.4")
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
    await stopServer(serverState);
  }
});

test("GET /discover forwards providerConfig from query params", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(
      createUrl(
        serverState.server,
        "/discover?codexModel=gpt-5-user&codexSandbox=workspace-write"
      )
    );

    assert.equal(response.status, 200);
    assert.deepEqual(serverState.getDiscoverConfig(), {
      codexModel: "gpt-5-user",
      codexSandbox: "workspace-write"
    });
  } finally {
    await stopServer(serverState);
  }
});

test("GET /health/:toolId reports unavailable tools", async () => {
  const serverState = await startServer({
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
    const response = await fetch(createUrl(serverState.server, "/health/codex"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "unavailable");
    assert.equal(body.reason, "CLI not found.");
  } finally {
    await stopServer(serverState);
  }
});

test("POST /chat/:toolId forwards chat calls", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/chat/codex"), {
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
    await stopServer(serverState);
  }
});

test("POST /chat/:toolId forwards providerConfig from the request body", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/chat/codex"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        providerConfig: {
          codexModel: "gpt-5-user",
          codexSandbox: "danger-full-access"
        }
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(serverState.getConnectConfig(), {
      codexModel: "gpt-5-user",
      codexSandbox: "danger-full-access"
    });
  } finally {
    await stopServer(serverState);
  }
});

test("POST /chat/:toolId falls back to the default model when the requested model is unavailable", async () => {
  const serverState = await startServer({
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
    const response = await fetch(createUrl(serverState.server, "/chat/codex"), {
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
    await stopServer(serverState);
  }
});

test("POST /chat/:toolId returns timeout errors", async () => {
  const serverState = await startServer({
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
    const response = await fetch(createUrl(serverState.server, "/chat/codex"), {
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
    await stopServer(serverState);
  }
});

test("POST /chat/:toolId validates the request body", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/chat/codex"), {
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
    await stopServer(serverState);
  }
});
