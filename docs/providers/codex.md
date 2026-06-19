---
title: Codex provider — switchboard-ai-sdk
description: Use OpenAI Codex with switchboard-ai-sdk. Covers discovery, auth, model selection, sandbox modes, errors, and a minimal example.
og:title: Codex provider for switchboard-ai-sdk
og:description: Integrate OpenAI Codex through switchboard-ai-sdk with discovery, auth flows, sandbox modes, and typed errors.
---

# Codex

Codex is an AI coding tool from OpenAI. switchboard-ai-sdk discovers the local `codex` CLI and normalizes chat, health checks, and auth flows behind one TypeScript API.

## How discovery works

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();
const codex = tools.find((t) => t.id === "codex");

console.log({
  available: codex?.available,
  version: codex?.version,
  capabilities: codex?.capabilities,
});
```

Discovery checks whether the `codex` CLI is installed and reachable. If a model is configured, it appears in `models` and `defaultModel`.

## How auth works

Codex requires authentication before handling chat requests.

```ts
const tool = await connect("codex");
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  console.log("Run:", result.command);
  console.log("Instructions:", result.instructions);
}
```

Typical flow:

1. Call `tool.checkAuth()`
2. If `unauthenticated`, call `tool.startAuth()`
3. Show the returned instructions to the user
4. Re-check auth before sending prompts

## How model selection works

Codex does not expose a machine-readable model list. The SDK mirrors the configured model into discovery results.

```ts
import { configure } from "switchboard-ai-sdk";

configure({
  codexModel: "gpt-5.5",
  codexSandbox: "workspace-write",
});
```

Without configuration, `models` is undefined and Codex uses its own default.

### Sandbox modes

Codex supports three sandbox levels:

| Mode | Effect |
|---|---|
| `read-only` | Can read files, cannot modify them |
| `workspace-write` | Can read and write within the workspace directory |
| `danger-full-access` | Full filesystem access; use with caution |

## Minimal example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  codexModel: "gpt-5.5",
  codexSandbox: "workspace-write",
});

const tool = await connect("codex");

const auth = await tool.checkAuth();
if (auth.authStatus === "unauthenticated") {
  const start = await tool.startAuth();
  console.log(start.instructions);
  process.exit(0);
}

const result = await tool.chat({
  messages: [
    { role: "user", content: "Refactor this function to use async/await." }
  ],
});

console.log(result.message.content);
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ToolNotFoundError` | Codex CLI is not installed | Install [Codex](https://github.com/openai/codex) |
| `ToolAuthError` | Not authenticated | Run the auth command returned by `startAuth()` |
| `ToolUnavailableError` | Codex CLI found but not responding | Restart the terminal or reinstall Codex |
| `ProviderExecutionError` | Codex returned an error or malformed output | Check the provider output and retry |
| `TimeoutError` | Request took too long | Increase `timeoutMs` or shorten the prompt |

## Limitations

- Model list is not dynamically discoverable; configure one explicitly if you need it
- Codex is an agent tool and may read/write files depending on the sandbox mode
- Auth requires user interaction; you cannot silently log in
- Output is not guaranteed to match other providers
