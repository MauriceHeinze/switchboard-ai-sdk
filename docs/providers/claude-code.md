---
title: Claude Code provider — switchboard-ai-sdk
description: Use Anthropic Claude Code with switchboard-ai-sdk. Covers discovery, auth, model selection, errors, and a minimal example.
og:title: Claude Code provider for switchboard-ai-sdk
og:description: Integrate Anthropic Claude Code through switchboard-ai-sdk with discovery, auth, configuration, and typed errors.
---

# Claude Code

Claude Code is Anthropic's CLI-based coding agent. switchboard-ai-sdk discovers the local `claude` CLI and exposes chat, health checks, and auth through the unified API.

## How discovery works

```ts
import { discover } from "switchboard-ai-sdk";

const tools = await discover();
const claude = tools.find((t) => t.id === "claude-code");

console.log({
  available: claude?.available,
  version: claude?.version,
  capabilities: claude?.capabilities,
});
```

Discovery checks whether the Claude Code CLI is installed and whether it reports a healthy state.

## How auth works

Claude Code uses Anthropic's authentication flow.

```ts
const tool = await connect("claude-code");
const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const result = await tool.startAuth();
  console.log("Run:", result.command);
  console.log("Instructions:", result.instructions);
}
```

The returned `instructions` tell the user what to do. After authentication completes, re-check auth and then chat.

## How model selection works

Claude Code does not expose a machine-readable model list. Configure the model explicitly to see it in discovery results.

```ts
import { configure } from "switchboard-ai-sdk";

configure({
  claudeCodeModel: "claude-sonnet-4",
  claudeCodeMaxTurns: 4,
});
```

- `claudeCodeModel` — sets the Claude model to use
- `claudeCodeMaxTurns` — maximum number of prompt/response turns before the agent completes

Without configuration, `models` is undefined.

## Minimal example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  claudeCodeModel: "claude-sonnet-4",
  claudeCodeMaxTurns: 4,
});

const tool = await connect("claude-code");

const auth = await tool.checkAuth();
if (auth.authStatus === "unauthenticated") {
  const start = await tool.startAuth();
  console.log(start.instructions);
  process.exit(0);
}

const result = await tool.chat({
  messages: [
    { role: "user", content: "Explain this TypeScript type error." }
  ],
});

console.log(result.message.content);
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ToolNotFoundError` | Claude Code CLI is not installed | Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code) |
| `ToolAuthError` | Not authenticated | Run the auth command returned by `startAuth()` |
| `ToolUnavailableError` | CLI found but not responding | Restart the terminal or reinstall Claude Code |
| `ProviderExecutionError` | Claude Code returned an error | Check the provider output and retry |
| `TimeoutError` | Request took too long | Increase `timeoutMs`; agent tasks may need 60–120 seconds |

## Limitations

- Model list is not dynamically discoverable; configure one explicitly if needed
- Claude Code is an agent tool and may read project context or modify files
- `claudeCodeMaxTurns` limits the conversation length
- Auth requires user interaction
