---
title: Use all four providers in one app — switchboard-ai-sdk use case
description: Build an app that works with Codex, Claude Code, OpenCode, and Ollama through a single switchboard-ai-sdk integration.
og:title: One integration for Codex, Claude Code, OpenCode, and Ollama
og:description: Use switchboard-ai-sdk to support all four local AI providers without writing provider-specific code.
---

# Use all four providers in one app

## Problem

You want your app to support the major local AI tools, but each one has a different interface:

- Codex uses the `codex` CLI with OpenAI auth
- Claude Code uses the `claude` CLI with Anthropic auth
- OpenCode uses its own CLI with free and paid model tiers
- Ollama exposes an HTTP API with no auth

Writing and maintaining four integrations is a lot of work.

## Why normal API integration is annoying

You would need to:

- learn four CLIs or APIs
- implement four auth flows
- normalize four response formats
- handle four different error styles

## How switchboard-ai-sdk solves it

switchboard-ai-sdk exposes one API for all four providers:

```ts
import { discover, connect } from "switchboard-ai-sdk";

const tools = await discover();
const supported = ["codex", "claude-code", "opencode", "ollama"];

const available = supported
  .map((id) => tools.find((t) => t.id === id && t.available))
  .filter(Boolean);

if (available.length === 0) {
  throw new Error("No supported AI tool found.");
}

// Let the user pick, or default to the first one
const tool = await connect(available[0].id);
const result = await tool.chat({
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(result.message.content);
```

## Normalized capabilities

The SDK exposes each tool with the same shape:

- `id` — provider identifier
- `type` — `agent` or `runtime`
- `capabilities` — what the tool can do
- `models` / `defaultModel` — available and default models
- `health()` — readiness check
- `checkAuth?()` / `startAuth?()` — auth helpers for agent tools
- `chat()` — unified chat interface

## Minimal provider switcher UI

```ts
const options = tools
  .filter((t) => supported.includes(t.id))
  .map((t) => ({ id: t.id, name: t.name, available: t.available }));

// Render options in your UI and connect to the selected id
const selected = await connect(userChoice);
```

## Limitations

- Provider-specific features may not be exposed through the unified API
- Agent tools can modify files; warn users and set sandbox levels appropriately
- Each provider still has its own model availability and auth state
