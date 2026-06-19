---
title: OpenCode provider — switchboard-ai-sdk
description: Use OpenCode with switchboard-ai-sdk. Covers discovery, auth, free and paid models, errors, and a minimal example.
og:title: OpenCode provider for switchboard-ai-sdk
og:description: Integrate OpenCode through switchboard-ai-sdk with discovery, auth, model selection including free tiers, and typed errors.
---

# OpenCode

OpenCode is a CLI-based AI coding tool that supports free hosted models, paid OpenCode Go models, and OpenAI-backed models. switchboard-ai-sdk discovers the local CLI and normalizes chat, health checks, auth, and model listing.

## How discovery works

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();
const opencode = tools.find((t) => t.id === "opencode");

console.log({
  available: opencode?.available,
  models: opencode?.models,
  defaultModel: opencode?.defaultModel,
});
```

OpenCode can enumerate its available models through the CLI, so `models` is populated when discovery succeeds.

## How auth works

OpenCode may require authentication depending on the model backend.

```ts
const tool = await connect("opencode");
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  console.log("Run:", result.command);
  console.log("Instructions:", result.instructions);
}
```

## How model selection works

OpenCode model names use the format `provider/model-name`. You can set a default:

```ts
import { configure } from "switchboard-ai-sdk";

configure({
  opencodeModel: "opencode/deepseek-v4-flash-free"
});
```

### Free models

No subscription required:

- `opencode/big-pickle`
- `opencode/deepseek-v4-flash-free`
- `opencode/mimo-v2.5-free`
- `opencode/nemotron-3-ultra-free`
- `opencode/north-mini-code-free`

### OpenCode Go models

Paid subscription:

- `opencode-go/deepseek-v4-flash`
- `opencode-go/deepseek-v4-pro`
- `opencode-go/glm-5.1`
- `opencode-go/glm-5.2`
- `opencode-go/kimi-k2.6`
- `opencode-go/kimi-k2.7-code`
- `opencode-go/mimo-v2.5`
- `opencode-go/mimo-v2.5-pro`
- `opencode-go/minimax-m2.7`
- `opencode-go/minimax-m3`
- `opencode-go/qwen3.6-plus`
- `opencode-go/qwen3.7-max`
- `opencode-go/qwen3.7-plus`

### OpenAI-backed models

Bring-your-own-key:

- `openai/gpt-5.3-codex-spark`
- `openai/gpt-5.4`
- `openai/gpt-5.4-fast`
- `openai/gpt-5.4-mini`
- `openai/gpt-5.4-mini-fast`
- `openai/gpt-5.5`
- `openai/gpt-5.5-fast`
- `openai/gpt-5.5-pro`

## Minimal example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  opencodeModel: "opencode/deepseek-v4-flash-free"
});

const tool = await connect("opencode");

const auth = await tool.checkAuth();
if (auth.authStatus === "unauthenticated") {
  const start = await tool.startAuth();
  console.log(start.instructions);
  process.exit(0);
}

const result = await tool.chat({
  messages: [
    { role: "user", content: "Write a Python function that reverses a string." }
  ],
});

console.log(result.message.content);
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ToolNotFoundError` | OpenCode CLI is not installed | Install [OpenCode](https://opencode.ai) |
| `ToolAuthError` | Model backend requires auth | Run the auth command from `startAuth()` |
| `ToolUnavailableError` | CLI found but not responding | Restart OpenCode or check your network |
| `ProviderExecutionError` | Invalid model name or CLI error | Verify the model name and OpenCode version |
| `TimeoutError` | Request took too long | Increase `timeoutMs` |

## Limitations

- Free models may change; verify current availability in OpenCode docs
- Some models route to cloud providers, so "local tool" does not always mean "offline"
- OpenCode is an agent tool and may modify files
- Model lineup changes frequently; check [OpenCode models](https://opencode.ai/docs/models/) for the latest list
