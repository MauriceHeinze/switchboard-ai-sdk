---
title: switchboard-ai-sdk
description: switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools already installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.
og:title: switchboard-ai-sdk — Local AI SDK for TypeScript
og:description: Connect your Node.js or Electron app to Codex, Claude Code, OpenCode, and Ollama through one unified SDK. Discover, connect, chat — no hosted API costs.
---
<script setup>
import HomeHero from ".vitepress/theme/Hero.vue";
</script>

<HomeHero />

## What is switchboard-ai-sdk?

`switchboard-ai-sdk` is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools already installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through **one consistent API**.

It normalizes the differences between local AI providers so you can:

- **Discover** what's available on the current machine
- **Connect** to Codex, Claude Code, Ollama, or OpenCode by id
- **Chat** through a unified interface that mirrors traditional LLM API calls
- **Check health** and **auth state** before sending prompts
- **Inspect provider usage limits** such as used percentage, remaining percentage, and reset windows when the provider exposes them locally
- **Run a local HTTP bridge** when the caller isn't a Node.js process

## Why switchboard-ai-sdk?

Local AI tooling is fragmented. Each provider differs across discovery, auth, model selection, request format, and error behavior. Apps end up writing custom glue code for every provider — or giving up and paying for hosted APIs.

switchboard-ai-sdk solves this by giving you one integration path across all four local providers. Write your app once, and let your users choose whichever AI tool they have installed.

**Core principles:**

- **Direct SDK first** — Use it in-process in Node.js or Electron. No server required.
- **Provider identity remains visible** — You know which tool you're talking to. Capabilities and agent behavior stay explicit.
- **Health and auth are first-class** — Check if a tool is ready before sending prompts. Auth failures have clear diagnostics.
- **Usage limits are visible when available** — Surface user-facing quota windows from providers like Codex and Claude Code without custom provider parsing in your app.
- **Typed errors** — `ToolNotFoundError`, `ToolAuthError`, `ProviderExecutionError`, `TimeoutError` — not opaque HTTP 500s.

## Install

```bash
npm install switchboard-ai-sdk
```

## Quick Start

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
const response = await tool.chat({
  messages: [
    { role: "user", content: "Generate me a list of five healthy lunch ideas." }
  ]
});

console.log(response?.message.content);
```

No API keys, no hosted billing. Just use the AI tools your users already have.

## Supported Providers

| Provider | Type | Discovery | Chat | Health | Auth | Models |
|---|---|---|---|---|---|---|
| **OpenCode** | Agent | CLI-based | ✓ | ✓ | ✓ | Full model list |
| **Codex** | Agent | CLI-based | ✓ | ✓ | ✓ | Configured model |
| **Claude Code** | Agent | CLI-based | ✓ | ✓ | ✓ | Configured model |
| **Ollama** | Runtime | HTTP API | ✓ | ✓ | — | Installed models |

## Architecture at a Glance

```txt
Your App (Node.js / Electron)
  │
  ├─ import { discover, connect } from "switchboard-ai-sdk"
  │
  ├─ discover() ──► scans for Codex, Claude Code, Ollama, OpenCode
  │                  returns capabilities, models, availability
  │
  ├─ connect(id) ─► returns a ConnectedTool with unified interface
  │                  prov                ider-specific logic stays isolated
  │
  └─ tool.chat() ─► consistent { message, usage, metadata } response
     tool.health()
     tool.checkAuth?()
     tool.startAuth?()
```

## When to Use the HTTP Server

Use `startSwitchboardServer()` when:

- Your caller is not a Node.js process
- You want a process or network boundary between the SDK and the caller
- You need to expose AI tool access over HTTP

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({ port: 3000 });
// GET /discover, POST /chat/:toolId, GET /health, POST /auth/:toolId, etc.
```

## Next Steps

- **[Getting Started](/guide/getting-started)** — Detailed setup, configuration, environment variables
- **[Discovering Tools](/guide/discovery)** — How model discovery works per provider
- **[Connect & Chat](/guide/connect-chat)** — The `ConnectedTool` interface in depth
- **[HTTP Server](/guide/http-server)** — All endpoints with request/response examples
- **[API Reference](/api/reference)** — Complete TypeScript API documentation
- **[Compare](/compare)** — How switchboard-ai-sdk compares to alternatives
- **[For AI Agents](/for-ai-agents)** — Quick integration guide for coding agents
- **[llms.txt](/llms.txt)** — Machine-readable project overview
