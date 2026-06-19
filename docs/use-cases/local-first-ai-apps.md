---
title: Local-first AI apps — switchboard-ai-sdk use case
description: Build local-first apps that run AI entirely on the user's machine with switchboard-ai-sdk, Ollama, and local CLI tools.
og:title: Local-first AI apps with switchboard-ai-sdk
og:description: Keep AI processing on-device using installed tools like Ollama, Codex, Claude Code, and OpenCode.
---

# Local-first AI apps

## Problem

You are building an app where data should stay on the user's machine:

- privacy-sensitive workflows
- offline or intermittent connectivity
- compliance requirements that limit cloud processing

You still want AI features, but hosted APIs send user data to remote servers.

## Why normal API integration is annoying

Hosted LLM APIs:

- send prompts and context to third-party servers
- require network connectivity
- create compliance review overhead
- may retain data depending on provider terms

Local tools avoid all of this, but each tool has its own CLI, auth flow, request format, and error behavior.

## How switchboard-ai-sdk solves it

switchboard-ai-sdk discovers and normalizes local AI tools so your app can use whichever ones are installed without writing provider-specific glue code.

```ts
import { discover, connect } from "switchboard-ai-sdk";

const tools = await discover();
const local = tools.find((t) => t.available && t.id === "ollama");

if (!local) {
  console.log("No local runtime available. Install Ollama or another supported tool.");
  process.exit(1);
}

const tool = await connect(local.id);
const result = await tool.chat({
  messages: [{ role: "user", content: "Summarize this document privately." }],
});

console.log(result.message.content);
```

## Best local providers

- **Ollama** — fully local model runtime, no auth, works offline
- **Codex / Claude Code / OpenCode** — agent tools that run locally but may call their own cloud models depending on the user's account

## Limitations

- The user's machine must have a supported tool installed
- Local models may be slower or less capable than top-tier hosted models
- Some providers still route to cloud models even when run locally
- Model download size and hardware requirements are the user's responsibility
