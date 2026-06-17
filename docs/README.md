<p align="center">
  <img src="../logo/logo_full.svg" alt="switchboard-ai logo" />
</p>

# Docs

switchboard-ai is an open-source npm package for connecting apps to local AI tools through one unified API.

It is designed for developers who want an API-shaped integration but prefer to use local tools they already have instead of paying for hosted LLM APIs on every request.

This documentation area focuses on three things:

- how to connect to an available tool
- how to send a prompt
- what the response looks like

## Connect to an available tool

This is the same basic pattern you would use with a traditional provider SDK: pick a tool, connect, send input, read the response.

```ts
import { connect, discover } from "switchboard-ai";

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
  prompt: "Summarize this repository."
});

console.log(response?.message.content);
```

Use `chat()` for chat-style tools:

```ts
const response = await tool.chat?.({
  messages: [
    {
      role: "user",
      content: "Summarize this repository."
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

## Discover available models

`discover()` now returns model information when a provider can expose it.

```ts
import { discover } from "switchboard-ai";

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

If the requested model is known to be unavailable and the provider has a `defaultModel`, switchboard-ai returns a warning and falls back to that default.

```ts
const response = await callTool(
  "codex",
  {
    prompt: "Summarize this repository",
    model: "gpt-5.5"
  }
);

console.log(response.model);
console.log(response.warnings ?? []);
console.log(response.result.message.content);
```
