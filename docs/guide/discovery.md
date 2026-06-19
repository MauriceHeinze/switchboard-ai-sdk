---
title: Discovering Tools — switchboard-ai-sdk
description: Learn how switchboard-ai-sdk discovers local AI tools. Understand model discovery behavior for Ollama, Codex, Claude Code, and OpenCode.
og:title: Discovering Local AI Tools with switchboard-ai-sdk
og:description: Use discover() to find installed AI tools and list available models. Covers provider-by-provider discovery behavior.
---

# Discovering Tools

`discover()` scans the local machine for installed AI tools and returns metadata about each one — availability, capabilities, models, version, and type.

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();

for (const tool of tools) {
  console.log({
    id: tool.id,
    available: tool.available,
    capabilities: tool.capabilities,
    models: tool.models ?? [],
    defaultModel: tool.defaultModel ?? null
  });
}
```

## Return Type

```ts
type DiscoveredTool = {
  id: "claude-code" | "codex" | "ollama" | "opencode";
  name: string;
  type: "agent" | "runtime" | "server" | "unknown";
  available: boolean;
  version?: string;
  capabilities: string[];
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
};
```

### Type Field

- **`agent`** — Tools like Codex, Claude Code, and OpenCode that can autonomously execute tasks. These may read project context or modify files.
- **`runtime`** — Tools like Ollama that serve models but don't autonomously act on your environment.
- **`server`** / **`unknown`** — Reserved for future provider types.

### Capabilities

Capabilities describe what a tool can do without hard-coding provider assumptions:

| Capability | Meaning |
|---|---|
| `chat` | Can handle conversational prompts |
| `completion` | Supports text completion |
| `model-list` | Can enumerate available models |
| `agent-task` | Can execute agent-style autonomous tasks |
| `code-edit` | Can modify code files |
| `health-check` | Supports health status queries |
| `embeddings` | Supports text embeddings |

## Model Discovery by Provider

Each provider surfaces models differently depending on what its underlying CLI or API supports.

### Ollama

Ollama exposes its full list of installed local models via its HTTP API.

- `models` returns all installed models
- `defaultModel` is the configured `ollamaModel` or `SWITCHBOARD_OLLAMA_MODEL` if set, otherwise the first discovered model

### OpenCode

OpenCode can enumerate available models through its CLI.

- `models` returns the full model list from the OpenCode CLI
- `defaultModel` is the configured `opencodeModel` or `SWITCHBOARD_OPENCODE_MODEL` if set, otherwise the CLI default
- Model names follow the format `provider/model-name` (e.g. `openai/gpt-5.5`, `opencode/deepseek-v4-flash-free`)

#### Free Models (no subscription required)

`opencode/big-pickle`, `opencode/deepseek-v4-flash-free`, `opencode/mimo-v2.5-free`, `opencode/nemotron-3-ultra-free`, `opencode/north-mini-code-free`

#### OpenCode Go Models (paid subscription)

`opencode-go/deepseek-v4-flash`, `opencode-go/deepseek-v4-pro`, `opencode-go/glm-5.1`, `opencode-go/glm-5.2`, `opencode-go/kimi-k2.6`, `opencode-go/kimi-k2.7-code`, `opencode-go/mimo-v2.5`, `opencode-go/mimo-v2.5-pro`, `opencode-go/minimax-m2.7`, `opencode-go/minimax-m3`, `opencode-go/qwen3.6-plus`, `opencode-go/qwen3.7-max`, `opencode-go/qwen3.7-plus`

#### OpenAI-backed Models (bring your own key)

`openai/gpt-5.3-codex-spark`, `openai/gpt-5.4`, `openai/gpt-5.4-fast`, `openai/gpt-5.4-mini`, `openai/gpt-5.4-mini-fast`, `openai/gpt-5.5`, `openai/gpt-5.5-fast`, `openai/gpt-5.5-pro`

### Codex

Codex mirrors its configured model into `models` and `defaultModel` when one is explicitly set through `configure()` or environment variables.

- Without configuration: `models` is `undefined`
- With `codexModel` configured: `models` contains that single model, and it becomes `defaultModel`

### Claude Code

Claude Code mirrors its configured model, same as Codex:

- Without configuration: `models` is `undefined`
- With `claudeCodeModel` configured: `models` contains that single model, and it becomes `defaultModel`

## Picking a Provider

Use the discovery results to decide which tool to use:

```ts
const tools = await discover();

// Prefer an agent-type tool for coding tasks
const codingTool = tools.find(t => t.type === "agent" && t.available);

// Fall back to any available tool
const anyTool = tools.find(t => t.available);

// Pick a specific tool by ID
const ollama = tools.find(t => t.id === "ollama");
```
