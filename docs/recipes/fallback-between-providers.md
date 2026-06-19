---
title: Fallback between providers — switchboard-ai-sdk recipe
description: Automatically fall back between Codex, Claude Code, OpenCode, and Ollama with switchboard-ai-sdk.
og:title: Fallback between providers — switchboard-ai-sdk
og:description: Pick the best available local AI tool at runtime and fall back across providers.
---

# Fallback between providers

Pick a preferred provider and fall back if it is unavailable.

```ts
import { chat } from "switchboard-ai-sdk";

async function ask(prompt: string) {
  const result = await chat(
    {
      messages: [{ role: "user", content: prompt }]
    },
    {
      providers: ["ollama", "opencode", "codex", "claude-code"],
      retries: 1,
      perAttemptTimeoutMs: 15000
    }
  );

  return result.result.message.content;
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
