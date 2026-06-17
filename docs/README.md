<p align="center">
  <img src="../logo/logo_full.svg" alt="switchboard-ai-sdk logo" />
</p>

# Docs

switchboard-ai-sdk is an open-source npm package for connecting apps to local AI tools through one unified API.

It is designed for developers who want an API-shaped integration but prefer to use local tools they already have instead of paying for hosted LLM APIs on every request.

This documentation area focuses on three things:

- how to connect to an available tool
- how to send a prompt
- what the response looks like

## Connect to an available tool

This is the same basic pattern you would use with a traditional provider SDK: pick a tool, connect, send input, read the response.

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
```

## Send a prompt

Use `run()` for prompt-style tools:

```ts
const response = await tool.run?.({
  prompt: "Generate me a list of five healthy lunch ideas."
});

console.log(response?.message.content);
```

Use `chat()` for chat-style tools:

```ts
const response = await tool.chat?.({
  messages: [
    {
      role: "user",
      content: "Generate me a list of five healthy lunch ideas."
    }
  ]
});

console.log(response?.message.content);
```

## Response shape

All tool calls return the same result format:

```ts
{
  message: {
    role: "assistant",
    content: "..."
  },
  usage: {
    // optional numeric provider metrics
  },
  metadata: {
    // optional provider-specific details
  }
}
```

If you use `callTool()`, the unified result is returned inside `response.result`.

## Example responses

This is what the validator output looks like when local tools are available:

### `GET /discover`

```json
{
  "tools": [
    {
      "name": "Claude Code",
      "available": true
    },
    {
      "name": "Codex",
      "available": true
    },
    {
      "name": "Ollama",
      "available": true,
      "models": [
        "qwen3:14b"
      ]
    },
    {
      "name": "OpenCode",
      "available": true
    }
  ]
}
```

### `GET /health/:toolId`

```json
{
  "toolId": "codex",
  "status": "healthy",
  "available": true,
  "version": "codex-cli 0.136.0",
  "latencyMs": 406,
  "checkedAt": "2026-06-17T12:54:44.900Z"
}
```

### `POST /call/:toolId`

Agent-style response:

```json
{
  "toolId": "codex",
  "type": "agent",
  "model": "gpt-5.4",
  "result": {
    "message": {
      "role": "assistant",
      "content": "1. Add a lightweight onboarding flow that shows users one successful path in under 60 seconds.\n2. Surface model cost and latency per action so teams can tune usage without guessing.\n3. Build a reusable prompt/version registry with rollback support.\n4. Add end-to-end evals for the top 3 critical agent workflows before shipping new changes.\n5. Create a simple activity timeline so users can inspect what the agent did and why."
    },
    "usage": {
      "input_tokens": 16644,
      "cached_input_tokens": 4480,
      "output_tokens": 112,
      "reasoning_output_tokens": 19
    }
  },
  "latencyMs": 9727
}
```

Runtime-style response:

```json
{
  "toolId": "ollama",
  "type": "runtime",
  "model": "qwen3:14b",
  "result": {
    "message": {
      "role": "assistant",
      "content": "1. Start a community garden.  \n2. Learn a new language online.  \n3. Volunteer at a local animal shelter.  \n4. Try a new hobby like painting or photography.  \n5. Plan a short trip to a nearby town or city."
    },
    "usage": {
      "total_duration": 5154960875,
      "load_duration": 119292500,
      "prompt_eval_count": 26,
      "prompt_eval_duration": 323903000,
      "eval_count": 53,
      "eval_duration": 4710088000
    },
    "metadata": {
      "model": "qwen3:14b",
      "done": true,
      "doneReason": "stop"
    }
  },
  "latencyMs": 5576
}
```

## Discover available models

`discover()` now returns model information when a provider can expose it.

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();

for (const tool of tools) {
  console.log({
    id: tool.id,
    available: tool.available,
    models: tool.models ?? [],
    defaultModel: tool.defaultModel ?? null
  });
}
```

Current behavior:

- Ollama returns installed local models and uses `SWITCHBOARD_OLLAMA_MODEL` as `defaultModel` when it is set; otherwise it falls back to the first discovered model.
- Codex, Claude Code, and OpenCode currently mirror their configured model into `models` and `defaultModel` when one is explicitly set.
- Providers without a stable machine-readable model listing mechanism leave `models` undefined when nothing is configured.

The HTTP `GET /discover` endpoint is intentionally slimmer than the library API:

- all providers return only `name` and `available`
- Ollama additionally returns `models`

## Override the model per call

`callTool()` and the HTTP `/call/:toolId` endpoint accept an optional `model` field.

If the requested model is known to be unavailable and the provider has a `defaultModel`, switchboard-ai-sdk returns a warning and falls back to that default.

```ts
const response = await callTool(
  "codex",
  {
    prompt: "Generate me a list of five healthy lunch ideas.",
    model: "gpt-5.5"
  }
);

console.log(response.model);
console.log(response.warnings ?? []);
console.log(response.result.message.content);
```
