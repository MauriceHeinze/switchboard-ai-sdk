---
title: Connect to Ollama — switchboard-ai-sdk recipe
description: Connect to Ollama and send a chat prompt with switchboard-ai-sdk.
og:title: Connect to Ollama — switchboard-ai-sdk
og:description: Configure Ollama host and model, then send a chat prompt through switchboard-ai-sdk.
---

# Connect to Ollama

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  ollamaHost: "http://127.0.0.1:11434",
  ollamaModel: "qwen3:14b",
});

const tool = await connect("ollama");

if (!(await tool.health())) {
  throw new Error("Ollama is not running.");
}

const result = await tool.chat({
  messages: [{ role: "user", content: "Explain recursion." }],
});

console.log(result.message.content);
```

## Override the model for one call

```ts
const result = await tool.chat({
  messages: [{ role: "user", content: "Hello" }],
  model: "llama3.1:latest",
});
```
