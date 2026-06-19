---
title: Providers — switchboard-ai-sdk
description: Detailed behavior for each supported AI provider. Covers Codex, Claude Code, Ollama, and OpenCode — discovery, auth, model support, and capabilities.
og:title: AI Provider Support in switchboard-ai-sdk
og:description: In-depth provider documentation for Codex, Claude Code, Ollama, and OpenCode. Discovery, auth flows, model selection, and capability details.
---

# Providers

switchboard-ai-sdk normalizes four local AI providers behind one interface. Each provider has unique behavior, capabilities, and configuration that the SDK handles transparently.

For provider-specific details, see the dedicated pages:

- [Codex](/providers/codex)
- [Claude Code](/providers/claude-code)
- [OpenCode](/providers/opencode)
- [Ollama](/providers/ollama)

## Provider Overview

| | Codex | Claude Code | Ollama | OpenCode |
|---|---|---|---|---|
| **Type** | Agent | Agent | Runtime | Agent |
| **Discovery** | CLI | CLI | HTTP API | CLI |
| **Chat** | ✓ | ✓ | ✓ | ✓ |
| **Health Check** | ✓ | ✓ | ✓ | ✓ |
| **Auth Check** | ✓ | ✓ | — | ✓ |
| **Auth Start** | ✓ | ✓ | — | ✓ |
| **Model List** | Configured | Configured | Full list | Full list |
| **Default Model Config** | ✓ | ✓ | ✓ | ✓ |

---

## Codex

**Type:** Agent

Codex is an AI coding tool from OpenAI. The SDK discovers it through the local CLI and supports chat, health checks, and auth flows.

### Configuration

```ts
configure({
  codexModel: "gpt-5.5",
  codexSandbox: "workspace-write"
});
```

### Sandbox Modes

Codex supports three sandbox levels that control what the agent can do on the filesystem:

- **`read-only`** — Agent can read files but not modify them
- **`workspace-write`** — Agent can read and write within the workspace directory
- **`danger-full-access`** — Agent has full filesystem access. Use with caution.

### Auth Flow

Codex requires authentication before handling chat requests:

```ts
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  console.log(result.command);      // e.g. "codex login"
  console.log(result.instructions); // e.g. "Visit https://example.com/device..."
}
```

### Model Discovery

When `codexModel` is configured, the model appears in discovery results. Without configuration, model info is not exposed.

---

## Claude Code

**Type:** Agent

Claude Code is Anthropic's CLI-based coding agent. The SDK discovers it through the local CLI.

### Configuration

```ts
configure({
  claudeCodeModel: "claude-sonnet-4",
  claudeCodeMaxTurns: 4
});
```

- `claudeCodeModel` — Sets the Claude model to use
- `claudeCodeMaxTurns` — Maximum number of prompt/response turns before the agent completes

### Auth Flow

Claude Code uses Anthropic's authentication:

```ts
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  // Follow the returned instructions to authenticate
}
```

### Model Discovery

When `claudeCodeModel` is configured, the model appears in discovery results. Without configuration, model info is not exposed.

---

## Ollama

**Type:** Runtime

Ollama is a local model runtime. The SDK discovers it through its HTTP API and retrieves the full list of installed models.

### Configuration

```ts
configure({
  ollamaHost: "http://192.168.1.20:11434",
  ollamaModel: "qwen3:14b"
});
```

- `ollamaHost` — Custom host URL (default: `http://127.0.0.1:11434`)
- `ollamaModel` — Default model for chat calls

### No Auth Required

Ollama does not require authentication. `checkAuth()` and `startAuth()` are not available on Ollama connected tools.

### Model Discovery

Ollama returns all installed local models. The `defaultModel` is:

1. The configured `ollamaModel` or `SWITCHBOARD_OLLAMA_MODEL` if set
2. Otherwise, the first model from the installed list

### Chat Response Metadata

Ollama responses include detailed timing metrics:

```json
{
  "usage": {
    "total_duration": 5154960875,
    "load_duration": 119292500,
    "prompt_eval_count": 26,
    "prompt_eval_duration": 323903000,
    "eval_count": 53,
    "eval_duration": 4710088000
  },
  "metadata": {
    "model": "qwen3:14b",
    "done": true,
    "doneReason": "stop"
  }
}
```

---

## OpenCode

**Type:** Agent

OpenCode is a CLI-based AI coding tool that supports both local and hosted model backends. The SDK discovers it through the CLI.

### Configuration

```ts
configure({
  opencodeModel: "openai/gpt-5.5"
});
```

### Free Models

OpenCode provides free hosted models for users without a paid subscription:

`opencode/big-pickle`, `opencode/deepseek-v4-flash-free`, `opencode/mimo-v2.5-free`, `opencode/nemotron-3-ultra-free`, `opencode/north-mini-code-free`

### OpenCode Go (Paid)

`opencode-go/deepseek-v4-flash`, `opencode-go/deepseek-v4-pro`, `opencode-go/glm-5.1`, `opencode-go/glm-5.2`, `opencode-go/kimi-k2.6`, `opencode-go/kimi-k2.7-code`, `opencode-go/mimo-v2.5`, `opencode-go/mimo-v2.5-pro`, `opencode-go/minimax-m2.7`, `opencode-go/minimax-m3`, `opencode-go/qwen3.6-plus`, `opencode-go/qwen3.7-max`, `opencode-go/qwen3.7-plus`

### OpenAI-backed (BYOK)

`openai/gpt-5.3-codex-spark`, `openai/gpt-5.4`, `openai/gpt-5.4-fast`, `openai/gpt-5.4-mini`, `openai/gpt-5.4-mini-fast`, `openai/gpt-5.5`, `openai/gpt-5.5-fast`, `openai/gpt-5.5-pro`

### Model Discovery

OpenCode exposes its full model list through the CLI. Model names use `provider/model-name` format.

### Auth Flow

```ts
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  // OpenCode auth flow
}
```

---

## Agent vs Runtime Tools

Understanding the distinction is important for apps to set appropriate user expectations and safety boundaries:

**Agent tools** (Codex, Claude Code, OpenCode):
- Can autonomously execute tasks, read project context, and modify files
- Support `agent-task` and `code-edit` capabilities
- May generate multiple internal steps before returning a response
- Type is exposed as `"agent"` so apps can surface this to users

**Runtime tools** (Ollama):
- Passively serve models and return completions
- Do not autonomously modify the environment
- Support `chat` and `completion` capabilities
- Type is exposed as `"runtime"`

The SDK never hides whether a tool is agent-capable. Always inspect `tool.type` and `tool.capabilities` before use.

## Safety Considerations

- Agent tools run on the user's machine with real filesystem access
- Sandbox configuration (Codex) should be set appropriately for the app's trust level
- Apps should inform users when connecting to agent-capable tools
- The SDK surfaces provider identity and capabilities explicitly — never abstract it away
