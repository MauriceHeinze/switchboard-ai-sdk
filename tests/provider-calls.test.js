import test from "node:test";
import assert from "node:assert/strict";
import { parseClaudeCodeJsonOutput } from "../dist/providers/claude-code.js";
import { parseCodexExecJsonOutput } from "../dist/providers/codex.js";
import { parseOpenCodeJsonOutput } from "../dist/providers/opencode.js";
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
  assert.throws(
    () =>
      parseClaudeCodeJsonOutput(
        JSON.stringify({
          type: "result",
          subtype: "error",
          is_error: true,
          result: "something went wrong"
        })
      ),
    /Claude Code returned an error/
  );
});

test("parseClaudeCodeJsonOutput throws on empty output", () => {
  assert.throws(
    () => parseClaudeCodeJsonOutput(""),
    /did not return any output/
  );
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
  assert.throws(
    () =>
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
      ),
    /OpenCode returned an error: API key missing/
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
    assert.equal(requests[0].url, "http://127.0.0.1:11434/api/chat");
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      model: "qwen3:14b",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
      think: false
    });
    assert.equal(result.message.content, "OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
