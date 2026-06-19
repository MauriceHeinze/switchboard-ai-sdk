import test from "node:test";
import assert from "node:assert/strict";
import { configure } from "../dist/index.js";
import {
  QuotaExceededError,
  RateLimitError
} from "../dist/errors/errors.js";
import {
  parseClaudeCodeAuthStatusOutput,
  parseClaudeCodeJsonOutput,
  parseClaudeCodeUsageLimitsSnapshot
} from "../dist/providers/claude-code.js";
import {
  parseCodexAuthStatusOutput,
  parseCodexExecJsonOutput,
  parseCodexUsageLimitsSnapshot
} from "../dist/providers/codex.js";
import {
  buildOpenCodeArgs,
  parseOpenCodeAuthStatusOutput,
  parseOpenCodeJsonOutput
} from "../dist/providers/opencode.js";
import {
  createProviderExecutionError,
  detectProviderFailureKind
} from "../dist/providers/error-classification.js";
import { ollamaProvider } from "../dist/providers/ollama.js";

test("parseCodexExecJsonOutput extracts the final agent message and usage", () => {
  const result = parseCodexExecJsonOutput([
    JSON.stringify({ type: "thread.started", thread_id: "abc" }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Hello from Codex" }
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 10, output_tokens: 5 }
    })
  ].join("\n"));

  assert.deepEqual(result, {
    message: {
      role: "assistant",
      content: "Hello from Codex"
    },
    usage: {
      input_tokens: 10,
      output_tokens: 5
    }
  });
});

test("parseClaudeCodeJsonOutput extracts result and usage", () => {
  const result = parseClaudeCodeJsonOutput(
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Hello from Claude Code",
      cost_usd: 0.05,
      duration_ms: 5000,
      num_turns: 2
    })
  );

  assert.deepEqual(result, {
    message: {
      role: "assistant",
      content: "Hello from Claude Code"
    },
    usage: {
      cost_usd: 0.05,
      duration_ms: 5000,
      num_turns: 2
    }
  });
});

test("parseClaudeCodeJsonOutput throws on error response", () => {
  assert.throws(() =>
    parseClaudeCodeJsonOutput(
      JSON.stringify({
        type: "result",
        subtype: "error",
        is_error: true,
        result: "something went wrong"
      })
    )
  );
});

test("parseClaudeCodeJsonOutput throws on empty output", () => {
  assert.throws(
    () => parseClaudeCodeJsonOutput(""),
    /did not return any output/
  );
});

test("parseClaudeCodeAuthStatusOutput parses authenticated JSON", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ authenticated: true })
  );

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: true,
    authStatus: "authenticated",
    reason: "Claude Code is authenticated.",
    command: "claude auth status --json",
    output: JSON.stringify({ authenticated: true })
  });
});

test("parseClaudeCodeAuthStatusOutput parses unauthenticated JSON", () => {
  const output = JSON.stringify({
    loggedIn: false,
    authMethod: "none",
    apiProvider: "firstParty"
  });
  const result = parseClaudeCodeAuthStatusOutput(output);

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: false,
    authStatus: "unauthenticated",
    reason: "Claude Code requires authentication before it can handle requests.",
    command: "claude auth status --json",
    output
  });
});

test("parseClaudeCodeUsageLimitsSnapshot extracts five-hour and seven-day windows", () => {
  const result = parseClaudeCodeUsageLimitsSnapshot({
    type: "status",
    payload: {
      rate_limits: {
        five_hour: {
          used_percentage: 23.5,
          resets_at: 1738425600
        },
        seven_day: {
          used_percentage: 41.2,
          resets_at: 1738857600
        }
      }
    }
  });

  assert.deepEqual(result, {
    status: "available",
    source: "local_session",
    plan: undefined,
    windows: {
      five_hour: {
        usedPercentage: 23.5,
        remainingPercentage: 76.5,
        resetsAt: "2025-02-01T16:00:00.000Z"
      },
      seven_day: {
        usedPercentage: 41.2,
        remainingPercentage: 58.8,
        resetsAt: "2025-02-06T16:00:00.000Z"
      }
    }
  });
});

test("parseOpenCodeJsonOutput extracts text events", () => {
  const result = parseOpenCodeJsonOutput([
    JSON.stringify({
      type: "step_start",
      timestamp: 1718600000000,
      sessionID: "sess_abc",
      part: { type: "step-start" }
    }),
    JSON.stringify({
      type: "text",
      timestamp: 1718600001000,
      sessionID: "sess_abc",
      part: {
        type: "text",
        text: "Hello from OpenCode",
        time: { start: 1718600000000, end: 1718600001000 }
      }
    }),
    JSON.stringify({
      type: "step_finish",
      timestamp: 1718600002000,
      sessionID: "sess_abc",
      part: { type: "step-finish" }
    })
  ].join("\n"));

  assert.deepEqual(result, {
    message: {
      role: "assistant",
      content: "Hello from OpenCode"
    }
  });
});

test("parseOpenCodeJsonOutput concatenates multiple text events", () => {
  const result = parseOpenCodeJsonOutput([
    JSON.stringify({
      type: "text",
      timestamp: 1718600001000,
      sessionID: "sess_abc",
      part: {
        type: "text",
        text: "First part",
        time: { start: 1718600000000, end: 1718600001000 }
      }
    }),
    JSON.stringify({
      type: "text",
      timestamp: 1718600003000,
      sessionID: "sess_abc",
      part: {
        type: "text",
        text: "Second part",
        time: { start: 1718600002000, end: 1718600003000 }
      }
    })
  ].join("\n"));

  assert.deepEqual(result, {
    message: {
      role: "assistant",
      content: "First part\n\nSecond part"
    }
  });
});

test("parseOpenCodeJsonOutput throws on error event", () => {
  assert.throws(() =>
    parseOpenCodeJsonOutput(
      JSON.stringify({
        type: "error",
        timestamp: 1718600000000,
        sessionID: "sess_abc",
        error: {
          name: "AuthError",
          data: { message: "API key missing" }
        }
      })
    )
  );
});

test("parseOpenCodeJsonOutput throws when no text events", () => {
  assert.throws(
    () =>
      parseOpenCodeJsonOutput(
        JSON.stringify({
          type: "step_start",
          timestamp: 1718600000000,
          sessionID: "sess_abc",
          part: { type: "step-start" }
        })
      ),
    /did not return a text response/
  );
});

test("parseCodexAuthStatusOutput parses unauthenticated text", () => {
  const output = "Not logged in. Run `codex login` to continue.";
  const result = parseCodexAuthStatusOutput(output);

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: false,
    authStatus: "unauthenticated",
    reason: "Codex requires authentication before it can handle requests.",
    command: "codex login status",
    output
  });
});

test("parseCodexUsageLimitsSnapshot extracts primary and secondary windows", () => {
  const result = parseCodexUsageLimitsSnapshot({
    timestamp: "2026-06-07T10:50:28.797Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      rate_limits: {
        primary: {
          used_percent: 36,
          window_minutes: 300,
          resets_at: 1780836346
        },
        secondary: {
          used_percent: 43,
          window_minutes: 10080,
          resets_at: 1781200147
        },
        plan_type: "plus"
      }
    }
  });

  assert.deepEqual(result, {
    status: "available",
    source: "local_session",
    plan: "plus",
    windows: {
      five_hour: {
        usedPercentage: 36,
        remainingPercentage: 64,
        resetsAt: "2026-06-07T12:45:46.000Z"
      },
      seven_day: {
        usedPercentage: 43,
        remainingPercentage: 57,
        resetsAt: "2026-06-11T17:49:07.000Z"
      }
    }
  });
});

test("parseOpenCodeAuthStatusOutput parses authenticated text heuristics", () => {
  const output = "default provider configured and connected";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: true,
    authStatus: "authenticated",
    reason: "OpenCode is authenticated.",
    command: "opencode auth list",
    output
  });
});

test("parseOpenCodeAuthStatusOutput parses credential list output", () => {
  const output = "\u001b[0m\n┌  Credentials ~/.local/share/opencode/auth.json\n│\n●  OpenAI oauth\n│\n└  1 credentials\n";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: true,
    authStatus: "authenticated",
    reason: "OpenCode is authenticated.",
    command: "opencode auth list",
    output
  });
});

test("parseOpenCodeAuthStatusOutput parses empty credential list output", () => {
  const output = "┌  Credentials ~/.local/share/opencode/auth.json\n└  0 credentials\n";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.deepEqual(result, {
    authSupported: true,
    authenticated: false,
    authStatus: "unauthenticated",
    reason: "OpenCode requires authentication before it can handle requests.",
    command: "opencode auth list",
    output
  });
});

test("buildOpenCodeArgs uses the selected model when provided", () => {
  const originalModel = process.env.SWITCHBOARD_OPENCODE_MODEL;
  process.env.SWITCHBOARD_OPENCODE_MODEL = "configured-model";

  try {
    assert.deepEqual(buildOpenCodeArgs({ prompt: "hello", model: "o3-mini" }), [
      "run",
      "--format",
      "json",
      "--model",
      "o3-mini",
      "--",
      "hello"
    ]);
  } finally {
    process.env.SWITCHBOARD_OPENCODE_MODEL = originalModel;
  }
});

test("buildOpenCodeArgs uses configured provider state when no model is provided", () => {
  configure({ opencodeModel: "configured-through-api" });

  try {
    assert.deepEqual(buildOpenCodeArgs({ prompt: "hello" }), [
      "run",
      "--format",
      "json",
      "--model",
      "configured-through-api",
      "--",
      "hello"
    ]);
  } finally {
    configure();
  }
});

test("detectProviderFailureKind classifies rate limits", () => {
  assert.equal(
    detectProviderFailureKind("429 too many requests, rate limit exceeded"),
    "rate_limited"
  );
});

test("detectProviderFailureKind classifies quota exhaustion", () => {
  assert.equal(
    detectProviderFailureKind("insufficient quota for this request"),
    "quota_exceeded"
  );
});

test("createProviderExecutionError returns RateLimitError when output indicates throttling", () => {
  const error = createProviderExecutionError(
    "codex",
    "Codex execution failed: rate limit exceeded",
    "429 too many requests"
  );

  assert.equal(error instanceof RateLimitError, true);
});

test("createProviderExecutionError returns QuotaExceededError when output indicates exhausted credit", () => {
  const error = createProviderExecutionError(
    "opencode",
    "OpenCode execution failed: insufficient quota",
    "billing says insufficient quota"
  );

  assert.equal(error instanceof QuotaExceededError, true);
});

test("ollamaProvider chat uses the discovered default model", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, init) => {
    requests.push({
      url,
      init
    });

    return new Response(
      JSON.stringify({
        model: "qwen3:14b",
        message: {
          content: "OK"
        },
        done: true
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  try {
    configure({ ollamaHost: "http://127.0.0.1:22434" });
    const tool = await ollamaProvider.connect({
      id: "ollama",
      name: "Ollama",
      type: "runtime",
      available: true,
      version: "0.1.0",
      capabilities: ["chat", "health-check"],
      defaultModel: "qwen3:14b"
    });

    const result = await tool.chat({
      messages: [{ role: "user", content: "hi" }]
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://127.0.0.1:22434/api/chat");
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      model: "qwen3:14b",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
      think: false
    });
    assert.equal(result.message.content, "OK");
  } finally {
    configure();
    globalThis.fetch = originalFetch;
  }
});
