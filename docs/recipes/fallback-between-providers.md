---
title: Fallback between providers — switchboard-ai-sdk recipe
description: Automatically fall back between Codex, Claude Code, OpenCode, and Ollama with switchboard-ai-sdk.
og:title: Fallback between providers — switchboard-ai-sdk
og:description: Pick the best available local AI tool at runtime and fall back across providers.
---

# Fallback between providers

Pick a preferred provider and fall back if it is unavailable.

```ts
import { discover, connect } from "switchboard-ai-sdk";

async function chatWithFallback(prompt: string) {
  const tools = await discover();
  const preference = ["ollama", "opencode", "codex", "claude-code"];

  const toolId = preference.find((id) =>
    tools.some((t) => t.id === id && t.available)
  );

  if (!toolId) {
    throw new Error("No local AI tool is available.");
  }

  const tool = await connect(toolId);

  if (tool.checkAuth) {
    const auth = await tool.checkAuth();
    if (auth.authStatus === "unauthenticated") {
      const start = await tool.startAuth();
      console.log("Auth required:", start.instructions);
      return null;
    }
  }

  if (!(await tool.health())) {
    throw new Error(`${tool.name} is not healthy.`);
  }

  const result = await tool.chat({
    messages: [{ role: "user", content: prompt }],
  });

  return result.message.content;
}
```

## Prefer runtime over agent

```ts
const preference = ["ollama", "opencode", "codex", "claude-code"];
```

## Prefer agent over runtime

```ts
const preference = ["codex", "claude-code", "opencode", "ollama"];
```
