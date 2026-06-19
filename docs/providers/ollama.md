---
title: Ollama provider — switchboard-ai-sdk
description: Use Ollama with switchboard-ai-sdk. Covers discovery, model listing, host configuration, errors, and a minimal example.
og:title: Ollama provider for switchboard-ai-sdk
og:description: Integrate Ollama through switchboard-ai-sdk with discovery, installed model listing, custom host support, and typed errors.
---

# Ollama

Ollama is a local model runtime that serves models over HTTP. switchboard-ai-sdk discovers the Ollama server, lists installed models, and normalizes chat and health checks.

## How discovery works

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();
const ollama = tools.find((t) => t.id === "ollama");

console.log({
  available: ollama?.available,
  models: ollama?.models,
  defaultModel: ollama?.defaultModel,
});
```

Discovery calls the Ollama HTTP API at the configured host (default `http://127.0.0.1:11434`) and returns all installed models.

## How auth works

Ollama does not require authentication. `checkAuth()` and `startAuth()` are not available on Ollama connected tools.

## How model selection works

Ollama returns the full list of installed local models. The default model is chosen in this order:

1. Configured `ollamaModel` or `SWITCHBOARD_OLLAMA_MODEL`
2. First model returned by Ollama

```ts
import { configure } from "switchboard-ai-sdk";

configure({
  ollamaHost: "http://192.168.1.20:11434",
  ollamaModel: "qwen3:14b"
});
```

You can override per chat:

```ts
const result = await tool.chat({
  messages: [{ role: "user", content: "Hello" }],
  model: "llama3.1:latest"
});
```

## Minimal example

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect("ollama");

if (!(await tool.health())) {
  throw new Error("Ollama is not running.");
}

const result = await tool.chat({
  messages: [
    { role: "user", content: "Explain dependency injection in simple terms." }
  ],
});

console.log(result.message.content);
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ToolNotFoundError` | Ollama server is not reachable | Start Ollama or check `ollamaHost` |
| `ToolUnavailableError` | Ollama running but model missing | Pull the model with `ollama pull <model>` |
| `ProviderExecutionError` | Ollama returned an error | Check Ollama logs and retry |
| `TimeoutError` | Model loading or generation took too long | Increase `timeoutMs` or use a smaller model |

## Limitations

- Ollama must be installed and running separately
- Only models already pulled on the user's machine are available
- The first discovered model may not be the best one; configure a default when possible
- Ollama runs as a runtime, not an agent, so it will not autonomously modify files
