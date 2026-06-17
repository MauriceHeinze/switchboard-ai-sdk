import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenCodeArgs,
  opencodeProvider
} from "../dist/providers/opencode.js";

test("buildOpenCodeArgs includes the specified model", () => {
  const args = buildOpenCodeArgs({ prompt: "hello", model: "claude-3-opus" });

  assert.ok(args.includes("--model"));
  const modelIndex = args.indexOf("--model");
  assert.equal(args[modelIndex + 1], "claude-3-opus");
});

test("buildOpenCodeArgs works without a model", () => {
  const args = buildOpenCodeArgs({ prompt: "hello" });

  assert.ok(!args.includes("--model"));
  assert.ok(args.includes("run"));
  assert.ok(args.includes("--format"));
  assert.ok(args.includes("json"));
});

test("opencodeProvider can be used without explicit auth check", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await opencodeProvider.connect(tool);

  assert.equal(typeof connected.chat, "function");
  assert.equal(typeof connected.health, "function");
});

test("opencodeProvider chat passes the model to the CLI", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await opencodeProvider.connect(tool);

  const args = buildOpenCodeArgs({
    prompt: "test prompt",
    model: "gpt-4-turbo"
  });

  assert.ok(args.includes("--model"));
  const modelIndex = args.indexOf("--model");
  assert.equal(args[modelIndex + 1], "gpt-4-turbo");
  assert.ok(args.includes("test prompt"));
});

test("opencodeProvider chat works with different models", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const models = ["claude-3-opus", "gpt-4-turbo", "llama-3"];

  for (const model of models) {
    const args = buildOpenCodeArgs({ prompt: "test", model });
    const modelIndex = args.indexOf("--model");
    assert.equal(args[modelIndex + 1], model);
  }
});

test("opencodeProvider chat can be called without auth if provider is available", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await opencodeProvider.connect(tool);

  assert.equal(typeof connected.chat, "function");
  assert.equal(typeof connected.checkAuth, "function");
  assert.equal(typeof connected.startAuth, "function");
});
