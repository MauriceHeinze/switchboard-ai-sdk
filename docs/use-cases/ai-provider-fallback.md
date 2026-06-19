---
title: AI provider fallback — switchboard-ai-sdk use case
description: Build resilient apps that automatically fall back between Codex, Claude Code, OpenCode, and Ollama using switchboard-ai-sdk.
og:title: AI provider fallback with switchboard-ai-sdk
og:description: Discover the first available local AI tool and fall back across providers without provider-specific code.
---

# AI provider fallback

## Problem

Your users have different AI tools installed. Some have Codex, some have Ollama, some have nothing. You want your app to work for as many users as possible without hardcoding one provider.

## Why normal API integration is annoying

Most SDKs target one provider. Supporting multiple providers means:

- separate auth flows
- separate error handling
- separate model selection logic
- separate configuration keys

You either pick one provider and lose users, or write a lot of glue code.

## How switchboard-ai-sdk solves it

switchboard-ai-sdk normalizes discovery, health, auth, and chat across all supported providers. You can discover the available tools and pick the best one at runtime.

```ts
import { chat } from "switchboard-ai-sdk";

async function ask(prompt: string) {
  const result = await chat(
    {
      messages: [{ role: "user", content: prompt }]
    },
    {
      providers: ["ollama", "opencode", "codex", "claude-code"],
      retries: 1
    }
  );

  return result.result.message.content;
}
```

## Adding health and auth checks

For production use, check health before chatting and auth for agent tools:

```ts
if (!(await tool.health())) {
  throw new Error(`${tool.name} is not healthy.`);
}

if (tool.checkAuth) {
  const auth = await tool.checkAuth();
  if (auth.authStatus === "unauthenticated") {
    const start = await tool.startAuth();
    console.log(`Run: ${start.command}`);
    return null;
  }
}
```

## Limitations

- Fallback order is your app's decision; the SDK does not rank providers by quality
- Agent tools and runtime tools behave differently; your fallback logic should consider `tool.type`
- If no tool is installed, the SDK cannot create one for the user
