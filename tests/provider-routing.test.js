import test from "node:test";
import assert from "node:assert/strict";
import {
  chat,
  FallbackExhaustedError,
  QuotaExceededError,
  TimeoutError
} from "../dist/index.js";
import { providerRegistry } from "../dist/providers/index.js";

const ORIGINAL_PROVIDERS = {
  codex: providerRegistry.codex,
  "claude-code": providerRegistry["claude-code"],
  ollama: providerRegistry.ollama,
  opencode: providerRegistry.opencode
};

function restoreProviders() {
  providerRegistry.codex = ORIGINAL_PROVIDERS.codex;
  providerRegistry["claude-code"] = ORIGINAL_PROVIDERS["claude-code"];
  providerRegistry.ollama = ORIGINAL_PROVIDERS.ollama;
  providerRegistry.opencode = ORIGINAL_PROVIDERS.opencode;
}

function createDiscoveredTool(id, available = true) {
  return {
    id,
    name: id,
    type: id === "ollama" ? "runtime" : "agent",
    available,
    capabilities: ["chat", "health-check"],
    metadata: available ? undefined : { reason: `${id} unavailable` }
  };
}

function createConnectedTool(tool, overrides = {}) {
  return {
    id: tool.id,
    name: tool.name,
    type: tool.type,
    capabilities: tool.capabilities,
    async health() {
      return true;
    },
    async chat() {
      return {
        message: {
          role: "assistant",
          content: `${tool.id} ok`
        }
      };
    },
    ...overrides
  };
}

test.afterEach(() => {
  restoreProviders();
});

test("chat immediately skips unavailable providers", async () => {
  providerRegistry.codex = {
    async discover() {
      return createDiscoveredTool("codex", false);
    },
    async connect(tool) {
      return createConnectedTool(tool);
    }
  };
  providerRegistry["claude-code"] = {
    async discover() {
      return createDiscoveredTool("claude-code");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async chat() {
          return {
            message: {
              role: "assistant",
              content: "claude fallback"
            }
          };
        }
      });
    }
  };

  const result = await chat(
    {
      messages: [{ role: "user", content: "hello" }]
    },
    {
      providers: ["codex", "claude-code"]
    }
  );

  assert.equal(result.toolId, "claude-code");
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.attempts.map((attempt) => attempt.reason), [
    "unavailable",
    undefined
  ]);
});

test("chat retries timeouts before succeeding on the same provider", async () => {
  let calls = 0;
  providerRegistry.codex = {
    async discover() {
      return createDiscoveredTool("codex");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async chat() {
          calls += 1;

          if (calls === 1) {
            throw new TimeoutError();
          }

          return {
            message: {
              role: "assistant",
              content: "retried successfully"
            }
          };
        }
      });
    }
  };

  const result = await chat(
    {
      messages: [{ role: "user", content: "hello" }]
    },
    {
      providers: ["codex"],
      retries: 1
    }
  );

  assert.equal(result.toolId, "codex");
  assert.equal(calls, 2);
  assert.deepEqual(
    result.attempts.map((attempt) => [attempt.tryIndex, attempt.reason, attempt.outcome]),
    [
      [0, "timeout", "failed"],
      [1, undefined, "succeeded"]
    ]
  );
});

test("chat falls through after retry exhaustion", async () => {
  let codexCalls = 0;

  providerRegistry.codex = {
    async discover() {
      return createDiscoveredTool("codex");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async chat() {
          codexCalls += 1;
          throw new TimeoutError();
        }
      });
    }
  };
  providerRegistry.ollama = {
    async discover() {
      return createDiscoveredTool("ollama");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async chat() {
          return {
            message: {
              role: "assistant",
              content: "ollama fallback"
            }
          };
        }
      });
    }
  };

  const result = await chat(
    {
      messages: [{ role: "user", content: "hello" }]
    },
    {
      providers: ["codex", "ollama"],
      retries: 1
    }
  );

  assert.equal(codexCalls, 2);
  assert.equal(result.toolId, "ollama");
  assert.equal(result.fallbackUsed, true);
});

test("chat does not retry unauthenticated providers", async () => {
  let codexCalls = 0;

  providerRegistry.codex = {
    async discover() {
      return createDiscoveredTool("codex");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async checkAuth() {
          codexCalls += 1;
          return {
            authSupported: true,
            authenticated: false,
            authStatus: "unauthenticated",
            reason: "login required"
          };
        }
      });
    }
  };
  providerRegistry.opencode = {
    async discover() {
      return createDiscoveredTool("opencode");
    },
    async connect(tool) {
      return createConnectedTool(tool);
    }
  };

  const result = await chat(
    {
      messages: [{ role: "user", content: "hello" }]
    },
    {
      providers: ["codex", "opencode"],
      retries: 3
    }
  );

  assert.equal(result.toolId, "opencode");
  assert.equal(codexCalls, 1);
  assert.equal(result.attempts[0].reason, "unauthenticated");
  assert.equal(result.attempts[0].stage, "preflight");
});

test("chat throws FallbackExhaustedError with attempt history", async () => {
  providerRegistry.codex = {
    async discover() {
      return createDiscoveredTool("codex");
    },
    async connect(tool) {
      return createConnectedTool(tool, {
        async chat() {
          throw new QuotaExceededError("codex", "quota exhausted");
        }
      });
    }
  };
  providerRegistry.ollama = {
    async discover() {
      return createDiscoveredTool("ollama", false);
    },
    async connect(tool) {
      return createConnectedTool(tool);
    }
  };

  await assert.rejects(
    () =>
      chat(
        {
          messages: [{ role: "user", content: "hello" }]
        },
        {
          providers: ["codex", "ollama"],
          retries: 0
        }
      ),
    (error) => {
      assert.equal(error instanceof FallbackExhaustedError, true);
      assert.equal(error.attempts.length, 2);
      assert.equal(error.attempts[0].reason, "quota_exceeded");
      assert.equal(error.attempts[1].reason, "unavailable");
      return true;
    }
  );
});
