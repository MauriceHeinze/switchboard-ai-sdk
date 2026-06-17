import test from "node:test";
import assert from "node:assert/strict";
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
