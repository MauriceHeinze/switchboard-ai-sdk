---
title: Getting Started — switchboard-ai-sdk
description: Install switchboard-ai-sdk and make your first chat call. Covers installation, Node.js/Electron requirements, and provider configuration.
og:title: Getting Started with switchboard-ai-sdk
og:description: Install the SDK, configure providers, and send your first chat prompt in under 5 minutes. Works with Node.js and Electron.
---

# Getting Started

## Requirements

- **Node.js** 18+ or **Electron** with Node.js integration
- At least one local AI tool installed:
  - [Codex](https://github.com/openai/codex) (CLI)
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI)
  - [Ollama](https://ollama.com) (runtime)
  - [OpenCode](https://opencode.ai) (CLI)

## Install

```bash
npm install switchboard-ai-sdk
```

The published npm package name is `switchboard-ai-sdk`. It ships as ESM only (`"type": "module"`).

## First Call

Pick a provider you have installed and ready:

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect("ollama");

const response = await tool.chat({
  messages: [
    { role: "user", content: "Write a haiku about TypeScript." }
  ]
});

console.log(response.message.content);
```

If you don't know which providers are available, discover first:

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();
console.log(tools.map(t => ({ id: t.id, available: t.available })));
```

## Provider Configuration

Call `configure()` once at startup to set provider defaults:

```ts
import { configure, connect, discover } from "switchboard-ai-sdk";

configure({
  ollamaHost: "http://192.168.1.20:11434",
  ollamaModel: "qwen3:14b",
  codexModel: "gpt-5.5",
  codexSandbox: "workspace-write",
  claudeCodeModel: "claude-sonnet-4",
  claudeCodeMaxTurns: 4,
  opencodeModel: "openai/gpt-5.5"
});

const tools = await discover();
const tool = await connect("codex");
```

Configuration set via `configure()` applies to all subsequent SDK and server calls in the current process until you call `configure()` again.

### Available Config Fields

| Field | Type | Description |
|---|---|---|
| `ollamaHost` | `string` | Custom Ollama host URL (default: `http://127.0.0.1:11434`) |
| `ollamaModel` | `string` | Default model for Ollama chat calls |
| `codexModel` | `string` | Default model for Codex |
| `codexSandbox` | `"read-only" \| "workspace-write" \| "danger-full-access"` | Codex sandbox mode |
| `claudeCodeModel` | `string` | Default model for Claude Code |
| `claudeCodeMaxTurns` | `number` | Max prompt turns for Claude Code |
| `opencodeModel` | `string` | Default model for OpenCode |

## Environment Variables

Environment variables serve as base defaults — `configure()` values take precedence:

| Variable | Maps to |
|---|---|
| `OLLAMA_HOST` | `ollamaHost` |
| `SWITCHBOARD_OLLAMA_MODEL` | `ollamaModel` |
| `SWITCHBOARD_CODEX_MODEL` | `codexModel` |
| `SWITCHBOARD_CODEX_SANDBOX` | `codexSandbox` |
| `SWITCHBOARD_CLAUDE_CODE_MODEL` | `claudeCodeModel` |
| `SWITCHBOARD_CLAUDE_CODE_MAX_TURNS` | `claudeCodeMaxTurns` |
| `SWITCHBOARD_OPENCODE_MODEL` | `opencodeModel` |

Example:

```bash
SWITCHBOARD_OPENCODE_MODEL=opencode/deepseek-v4-flash-free node app.js
```

## Integration Paths

The SDK supports two integration paths. Choose based on your environment:

**Direct SDK** — Use when your app runs in Node.js or Electron:

- Electron main process integrations
- Desktop apps with direct Node.js access
- Local scripts and CLIs
- When you want typed exceptions instead of HTTP error codes

**HTTP Server** — Use when the caller isn't a Node.js process:

- Renderer-side calls from Electron (with a secure bridge)
- Non-Node.js backends
- Process-isolated architectures
- When JSON error payloads are preferred

## Next Steps

- **[Discovering Tools](/guide/discovery)** — Understand provider discovery and model listing
- **[Connect & Chat](/guide/connect-chat)** — Learn the full `ConnectedTool` API
- **[HTTP Server](/guide/http-server)** — Expose providers over HTTP
