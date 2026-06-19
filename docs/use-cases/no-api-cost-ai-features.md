---
title: No API cost AI features — switchboard-ai-sdk use case
description: Add AI features to your app without paying hosted LLM API costs by using tools your users already installed.
og:title: No API cost AI features with switchboard-ai-sdk
og:description: Let users bring their own Codex, Claude Code, OpenCode, or Ollama installation to power your app's AI features.
---

# No API cost AI features

## Problem

You want to ship AI features, but:

- hosted API costs scale with usage
- free tiers have hard limits
- you do not want to price or bill users per AI request

## Why normal API integration is annoying

Every hosted provider requires:

- an API key tied to your account
- per-token or per-request billing
- rate limits and quota monitoring
- a backend to protect the key

As your app grows, so does your API bill.

## How switchboard-ai-sdk solves it

switchboard-ai-sdk moves the cost model to the user side by using AI tools they already have installed. The app developer does not pay for the AI calls; the user runs their own local or authenticated CLI tool.

```ts
import { discover, connect } from "switchboard-ai-sdk";

async function generateIdeas(topic: string) {
  const tools = await discover();
  const tool = tools.find((t) => t.available && t.capabilities.includes("chat"));

  if (!tool) {
    throw new Error("Please install Ollama, Codex, Claude Code, or OpenCode.");
  }

  const client = await connect(tool.id);
  const result = await client.chat({
    messages: [{ role: "user", content: `Give me 5 ideas about ${topic}.` }],
  });

  return result.message.content;
}
```

## Free options

- **Ollama** — run open-source models locally; no API costs at all
- **OpenCode free models** — `opencode/deepseek-v4-flash-free` and similar tiers do not require a paid subscription

## Limitations

- The user must install and sometimes authenticate the tool
- Free models may have lower quality or rate limits set by the provider
- You still need to handle the case where no tool is available
- Some providers require paid accounts for their best models
