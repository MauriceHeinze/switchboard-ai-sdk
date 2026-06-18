import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { configure } from "../dist/index.js";
import { createSwitchboardServer } from "../dist/server/http.js";
import { getProviderConfig } from "../dist/config.js";
import { providerRegistry } from "../dist/providers/index.js";

const ORIGINAL_CODEX_PROVIDER = providerRegistry.codex;
const ORIGINAL_CLAUDE_PROVIDER = providerRegistry["claude-code"];
const ORIGINAL_OLLAMA_PROVIDER = providerRegistry.ollama;
const ORIGINAL_OPENCODE_PROVIDER = providerRegistry.opencode;

function createUrl(server, path) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected server to be listening on an address.");
  }

  return `http://127.0.0.1:${address.port}${path}`;
}

async function startServer(overrides = {}) {
  providerRegistry["claude-code"] = {
    async discover() {
      return {
        id: "claude-code",
        name: "Claude Code",
        type: "agent",
        available: true,
        version: "0.9.0",
        capabilities: ["agent-task", "health-check"]
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
        }
      };
    }
  };

  providerRegistry.ollama = {
    async discover() {
      return {
        id: "ollama",
        name: "Ollama",
        type: "runtime",
        available: true,
        version: "0.8.0",
        capabilities: ["chat", "health-check"],
        models: ["qwen3:14b"],
        defaultModel: "qwen3:14b"
      };
    },
    async connect(tool) {
      return {
        id: tool.id,
        name: tool.name,
        type: tool.type,
        capabilities: tool.capabilities,
        async checkAuth() {
          return {
            authSupported: false,
            authenticated: null,
            authStatus: "not_supported"
          };
        },
        async health() {
          return true;
        }
      };
    },
    async checkAuth() {
      return {
        authSupported: false,
        authenticated: null,
        authStatus: "not_supported"
      };
    },
    async startAuth() {
      return {
        status: "unsupported",
        authenticated: null,
        command: "ollama"
      };
    }
  };

  providerRegistry.opencode = {
    async discover() {
      return {
        id: "opencode",
        name: "OpenCode",
        type: "agent",
        available: true,
        version: "0.8.0",
        capabilities: ["agent-task", "health-check"],
        models: ["openai/gpt-5.4"]
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
        }
      };
    }
  };

  providerRegistry.codex = {
    async discover() {
      const config = getProviderConfig();
      const configuredModel = config.codexModel;

      return {
        id: "codex",
        name: "Codex",
        type: "agent",
        available: true,
        version: "1.2.3",
        capabilities: ["agent-task", "health-check"],
        models: configuredModel ? [configuredModel] : ["gpt-5-codex"],
        defaultModel: configuredModel ?? "gpt-5-codex"
      };
    },
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
    server
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
  providerRegistry["claude-code"] = ORIGINAL_CLAUDE_PROVIDER;
  providerRegistry.ollama = ORIGINAL_OLLAMA_PROVIDER;
  providerRegistry.opencode = ORIGINAL_OPENCODE_PROVIDER;
  configure();
}

test.afterEach(() => {
  assert.deepEqual(getProviderConfig(), {});
});

test("GET /health returns server liveness without auth", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/health"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeMs, "number");
    assert.ok(Array.isArray(body.tools));
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.toolId === "codex" &&
          tool.status === "healthy" &&
          tool.authSupported === false
      )
    );
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
          tool.id === "codex" &&
          tool.name === "Codex" &&
          tool.type === "agent" &&
          tool.available === true &&
          tool.version === "1.2.3" &&
          Array.isArray(tool.capabilities) &&
          tool.capabilities.includes("agent-task") &&
          Array.isArray(tool.models) &&
          tool.models.includes("gpt-5-codex") &&
          tool.defaultModel === "gpt-5-codex"
      )
    );
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.id === "opencode" &&
          tool.name === "OpenCode" &&
          tool.available === true &&
          tool.type === "agent" &&
          tool.version === "0.8.0" &&
          Array.isArray(tool.models) &&
          tool.models.includes("openai/gpt-5.4")
      )
    );
    assert.ok(
      body.tools.some(
        (tool) =>
          tool.id === "ollama" &&
          tool.name === "Ollama" &&
          tool.available === true &&
          tool.type === "runtime" &&
          tool.version === "0.8.0" &&
          Array.isArray(tool.models) &&
          tool.models.includes("qwen3:14b") &&
          tool.defaultModel === "qwen3:14b"
      )
    );
  } finally {
    await stopServer(serverState);
  }
});

test("GET /config returns the current process config", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/config"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      config: {}
    });
  } finally {
    await stopServer(serverState);
  }
});

test("PUT /config replaces process config for later requests", async () => {
  const serverState = await startServer();

  try {
    const updateResponse = await fetch(createUrl(serverState.server, "/config"), {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        codexModel: "gpt-5.5",
        codexSandbox: "workspace-write",
        claudeCodeMaxTurns: 4
      })
    });
    const updateBody = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.deepEqual(updateBody, {
      config: {
        codexModel: "gpt-5.5",
        codexSandbox: "workspace-write",
        claudeCodeMaxTurns: 4
      }
    });

    const configResponse = await fetch(createUrl(serverState.server, "/config"));
    const configBody = await configResponse.json();
    assert.deepEqual(configBody, updateBody);

    const discoverResponse = await fetch(createUrl(serverState.server, "/discover"));
    const discoverBody = await discoverResponse.json();
    const codex = discoverBody.tools.find((tool) => tool.id === "codex");

    assert.equal(codex.defaultModel, "gpt-5.5");
    assert.deepEqual(codex.models, ["gpt-5.5"]);
  } finally {
    await stopServer(serverState);
  }
});

test("PUT /config with an empty object resets process config", async () => {
  const serverState = await startServer();

  try {
    await fetch(createUrl(serverState.server, "/config"), {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        codexModel: "gpt-5.5"
      })
    });

    const resetResponse = await fetch(createUrl(serverState.server, "/config"), {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const resetBody = await resetResponse.json();

    assert.equal(resetResponse.status, 200);
    assert.deepEqual(resetBody, {
      config: {}
    });
  } finally {
    await stopServer(serverState);
  }
});

test("PUT /config validates config payloads", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/config"), {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        claudeCodeMaxTurns: 0
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "invalid_request");
    assert.match(body.error.message, /claudeCodeMaxTurns must be a positive number/);
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
    assert.equal(body.authStatus, "not_supported");
  } finally {
    await stopServer(serverState);
  }
});

test("GET /health/:toolId reports unauthenticated tools distinctly", async () => {
  const serverState = await startServer({
    async checkAuth() {
      return {
        authSupported: true,
        authenticated: false,
        authStatus: "unauthenticated",
        reason: "Codex requires authentication before it can handle requests."
      };
    }
  });

  try {
    const response = await fetch(createUrl(serverState.server, "/health/codex"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "unavailable");
    assert.equal(body.available, false);
    assert.equal(body.authSupported, true);
    assert.equal(body.authenticated, false);
    assert.equal(body.authStatus, "unauthenticated");
  } finally {
    await stopServer(serverState);
  }
});

test("POST /auth/:toolId returns started for provider login flows", async () => {
  const serverState = await startServer({
    async startAuth() {
      return {
        status: "started",
        authenticated: false,
        command: "codex login",
        instructions: "Visit https://example.com/device",
        output: "Visit https://example.com/device"
      };
    }
  });

  try {
    const response = await fetch(createUrl(serverState.server, "/auth/codex"), {
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "started");
    assert.equal(body.command, "codex login");
    assert.match(body.instructions, /example\.com\/device/);
  } finally {
    await stopServer(serverState);
  }
});

test("POST /auth/:toolId returns already authenticated when the provider is logged in", async () => {
  const serverState = await startServer();

  providerRegistry["claude-code"] = {
    async discover() {
      return {
        id: "claude-code",
        name: "Claude Code",
        type: "agent",
        available: true,
        version: "0.9.0",
        capabilities: ["agent-task", "health-check"]
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
        }
      };
    },
    async startAuth() {
      return {
        status: "already_authenticated",
        authenticated: true,
        command: "claude auth login --claudeai",
        output: "Already logged in"
      };
    }
  };

  try {
    const response = await fetch(
      createUrl(serverState.server, "/auth/claude-code"),
      { method: "POST" }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "already_authenticated");
    assert.equal(body.authenticated, true);
  } finally {
    await stopServer(serverState);
  }
});

test("POST /auth/:toolId returns unsupported for non-auth providers", async () => {
  const serverState = await startServer();

  try {
    const response = await fetch(createUrl(serverState.server, "/auth/ollama"), {
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "unsupported");
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
