<p align="center">
  <img src="../logo/logo_full.svg" alt="switchboard-ai logo" />
</p>

# API Reference

Technical reference for `switchboard-ai`. The published npm package name is `switchboard-ai-sdk`. For installation, positioning, and the getting-started flow, start with the root [README.md](../README.md). For the direct non-HTTP integration flow, see [DIRECT-USAGE.md](./DIRECT-USAGE.md).

## Direct SDK API

Use the library API when your app does not need the local HTTP server.

### `discover(options?)`

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover({
  providerConfig: {
    ollamaHost: "http://192.168.1.20:11434",
    ollamaModel: "qwen3:14b"
  }
});
```

Returns:

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

### `connect(input, options?)`

Connect by provider id:

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect("ollama", {
  providerConfig: {
    ollamaHost: "http://192.168.1.20:11434"
  }
});
```

Connect by capability:

```ts
const tool = await connect({
  capability: "chat",
  prefer: ["ollama", "codex", "opencode"]
}, {
  providerConfig: {
    codexSandbox: "workspace-write"
  }
});
```

Supported `providerConfig` fields:

```ts
type ProviderConfig = {
  ollamaHost?: string;
  ollamaModel?: string;
  codexModel?: string;
  codexSandbox?: "read-only" | "workspace-write" | "danger-full-access";
  claudeCodeModel?: string;
  claudeCodeMaxTurns?: number;
  opencodeModel?: string;
};
```

`connect()` returns a `ConnectedTool`:

```ts
type ConnectedTool = {
  id: "claude-code" | "codex" | "ollama" | "opencode";
  name: string;
  type: "agent" | "runtime" | "server" | "unknown";
  capabilities: string[];
  models?: string[];
  defaultModel?: string;
  health(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<boolean>;
  chat(
    input: {
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      model?: string;
    },
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<ToolResult>;
};
```

## `tool.chat()` Response Shape

`chat()` returns this result format:

```ts
{
  message: {
    role: "assistant",
    content: "..."
  },
  usage: {
    // optional numeric provider metrics
  },
  metadata: {
    // optional provider-specific details
  }
}
```

### Direct SDK Errors

Direct SDK calls throw typed errors:

- `ToolNotFoundError`
- `ToolUnavailableError`
- `CapabilityNotSupportedError`
- `ProviderExecutionError`
- `TimeoutError`
- `ToolAuthError`

Use the HTTP server only if you want those failures translated into HTTP statuses and JSON error payloads.

## HTTP Endpoint Examples

This is what the validator output looks like when local tools are available:

### `GET /discover`

Optional query params mirror `providerConfig`, for example:

```text
/discover?ollamaHost=http://192.168.1.20:11434&ollamaModel=qwen3:14b
```

```json
{
  "tools": [
    {
      "name": "Claude Code",
      "available": true
    },
    {
      "name": "Codex",
      "available": true
    },
    {
      "name": "Ollama",
      "available": true,
      "models": [
        "qwen3:14b"
      ]
    },
    {
      "name": "OpenCode",
      "available": true
    }
  ]
}
```

### `GET /health/:toolId`

Optional query params mirror `providerConfig`, for example:

```text
/health/codex?codexModel=gpt-5.5&codexSandbox=workspace-write
```

```json
{
  "toolId": "codex",
  "status": "healthy",
  "available": true,
  "version": "codex-cli 0.136.0",
  "latencyMs": 406,
  "checkedAt": "2026-06-17T12:54:44.900Z"
}
```

### `POST /chat/:toolId` request

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Reply with a short list of 5 ideas."
    }
  ],
  "providerConfig": {
    "codexModel": "gpt-5.5",
    "codexSandbox": "workspace-write"
  },
  "timeoutMs": 30000
}
```

### `POST /chat/:toolId` response

```json
{
  "toolId": "codex",
  "type": "agent",
  "model": "gpt-5.4",
  "result": {
    "message": {
      "role": "assistant",
      "content": "1. Add a lightweight onboarding flow for first-time users.\n2. Surface AI action history with simple search and filters.\n3. Create a sandbox mode for testing automations safely.\n4. Add usage analytics with clear cost and time savings.\n5. Build reusable templates for common switchboard workflows."
    },
    "usage": {
      "input_tokens": 16646,
      "cached_input_tokens": 2432,
      "output_tokens": 76,
      "reasoning_output_tokens": 11
    }
  },
  "latencyMs": 8086
}
```

### `tool.chat()` response

```json
{
  "message": {
    "role": "assistant",
    "content": "1. Start a community garden.  \n2. Learn a new language online.  \n3. Volunteer at a local animal shelter.  \n4. Try a new hobby like painting or photography.  \n5. Plan a short trip to a nearby town or city."
  },
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

## Model Discovery Behavior

`discover()` returns model information when a provider can expose it.

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();

for (const tool of tools) {
  console.log({
    id: tool.id,
    available: tool.available,
    models: tool.models ?? [],
    defaultModel: tool.defaultModel ?? null
  });
}
```

Current behavior:

- Ollama returns installed local models and uses `providerConfig.ollamaModel` or `SWITCHBOARD_OLLAMA_MODEL` as `defaultModel` when one is set; otherwise it falls back to the first discovered model.
- Codex and Claude Code currently mirror their configured model into `models` and `defaultModel` when one is explicitly set through `providerConfig` or environment/config files.
- OpenCode can expose its available models from the CLI. You can also force a specific model with `providerConfig.opencodeModel` or `SWITCHBOARD_OPENCODE_MODEL`.
- Providers without a stable machine-readable model listing mechanism leave `models` undefined when nothing is configured.

For OpenCode, the currently supported model names are easiest to understand in three groups:

- Free OpenCode-hosted models for users who do not have or do not want to provide a paid AI subscription: `opencode/big-pickle`, `opencode/deepseek-v4-flash-free`, `opencode/mimo-v2.5-free`, `opencode/nemotron-3-ultra-free`, `opencode/north-mini-code-free`
- Hosted `opencode-go` models: `opencode-go/deepseek-v4-flash`, `opencode-go/deepseek-v4-pro`, `opencode-go/glm-5.1`, `opencode-go/glm-5.2`, `opencode-go/kimi-k2.6`, `opencode-go/kimi-k2.7-code`, `opencode-go/mimo-v2.5`, `opencode-go/mimo-v2.5-pro`, `opencode-go/minimax-m2.7`, `opencode-go/minimax-m3`, `opencode-go/qwen3.6-plus`, `opencode-go/qwen3.7-max`, `opencode-go/qwen3.7-plus`
- OpenAI-backed models available through OpenCode: `openai/gpt-5.3-codex-spark`, `openai/gpt-5.4`, `openai/gpt-5.4-fast`, `openai/gpt-5.4-mini`, `openai/gpt-5.4-mini-fast`, `openai/gpt-5.5`, `openai/gpt-5.5-fast`, `openai/gpt-5.5-pro`

The HTTP `GET /discover` endpoint is intentionally slimmer than the library API:

- all providers return only `name` and `available`
- Ollama additionally returns `models`
