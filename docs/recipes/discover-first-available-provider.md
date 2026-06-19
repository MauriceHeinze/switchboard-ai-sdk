---
title: Discover the first available provider — switchboard-ai-sdk recipe
description: Find the first installed and available AI tool with switchboard-ai-sdk.
og:title: Discover first available provider — switchboard-ai-sdk
og:description: Use discover() to find and connect to the first available local AI tool.
---

# Discover the first available provider

Find the first installed AI tool that is ready to use.

```ts
import { discover, connect } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
const result = await tool.chat({
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(result.message.content);
```

## Prefer chat-capable tools

```ts
const toolId = tools.find(
  (tool) => tool.available && tool.capabilities.includes("chat")
)?.id;
```
