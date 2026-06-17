import test from "node:test";
import assert from "node:assert/strict";
import { parseClaudeCodeJsonOutput } from "../dist/providers/claude-code.js";
import { parseCodexExecJsonOutput } from "../dist/providers/codex.js";
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
