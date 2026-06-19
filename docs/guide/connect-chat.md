---
title: Connect & Chat — switchboard-ai-sdk
description: Learn how to connect to AI providers and send chat prompts. Full ConnectedTool API reference with health checks, auth, and timeout control.
og:title: Connect & Chat with switchboard-ai-sdk
og:description: Use connect() to get a ConnectedTool, then call chat(), health(), checkAuth(), and startAuth(). Full TypeScript API with timeouts and abort signals.
---

# Connect & Chat

## Connecting to a Provider

`connect()` establishes a session with a specific AI tool. Call it after discovery to get a `ConnectedTool` object:

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const tool = await connect("ollama");
```

You can also connect directly without discovery if you know the provider ID:

```ts
const tool = await connect("codex");
const tool = await connect("claude-code");
const tool = await connect("opencode");
const tool = await connect("ollama");
```

## The ConnectedTool Interface

```ts
type ConnectedTool = {
  id: "claude-code" | "codex" | "ollama" | "opencode";
  name: string;
  type: "agent" | "runtime" | "server" | "unknown";
  capabilities: string[];
  models?: string[];
  defaultModel?: string;

  chat(input: ChatInput, options?: ToolOperationOptions): Promise<ToolResult>;
  health(options?: ToolOperationOptions): Promise<boolean>;
  checkAuth?(options?: ToolOperationOptions): Promise<AuthCheckResult>;
  startAuth?(options?: ToolOperationOptions): Promise<AuthStartResult>;
};
```

## Sending Chat Prompts

```ts
const response = await tool.chat({
  messages: [
    { role: "user", content: "Summarize the main idea in one paragraph." }
  ]
});

console.log(response.message.content);
```

### ChatInput

```ts
type ChatInput = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string; // Override the default model for this call
};
```

### ToolResult

```ts
type ToolResult = {
  message: {
    role: "assistant";
    content: string;
  };
  usage?: {
    // Provider-specific token / timing metrics
    [key: string]: number | undefined;
  };
  metadata?: {
    // Provider-specific details (model name, done reason, etc.)
    [key: string]: unknown;
  };
};
```

### Timeouts and Cancellation

All tool methods accept an optional `options` argument:

```ts
type ToolOperationOptions = {
  signal?: AbortSignal;   // Cancel the operation
  timeoutMs?: number;     // Timeout in milliseconds
};
```

Example:

```ts
const controller = new AbortController();

const response = await tool.chat(
  {
    messages: [{ role: "user", content: "Hello" }]
  },
  {
    timeoutMs: 30000,
    signal: controller.signal
  }
);

// Cancel early if needed
controller.abort();
```

If the timeout is exceeded, a `TimeoutError` is thrown.

## Health Checks

Check whether a provider is ready to handle requests:

```ts
const healthy = await tool.health();

if (healthy) {
  // Provider is ready — send prompts
} else {
  // Provider is unavailable or has an issue
}
```

`health()` returns a `boolean`. It checks provider availability and basic readiness — not deep auth state (use `checkAuth()` for that).

## Auth Checks

For providers that support authentication (Codex, Claude Code, OpenCode), `checkAuth()` inspects the current auth state:

```ts
const auth = await tool.checkAuth();

console.log({
  authSupported: auth.authSupported,
  authenticated: auth.authenticated,
  authStatus: auth.authStatus,
  reason: auth.reason
});
```

Auth status values:

| Status | Meaning |
|---|---|
| `authenticated` | Provider is signed in and ready |
| `unauthenticated` | Provider needs sign-in before use |
| `not_supported` | This provider doesn't use auth |
| `unknown` | Could not determine auth state |

## Starting Authentication

If a provider reports `unauthenticated`, start the auth flow:

```ts
const result = await tool.startAuth();

console.log(result.command);        // CLI command to run
console.log(result.instructions);   // What the user needs to do
console.log(result.status);         // "already_authenticated" | "started" | "unsupported" | "failed"
```

Typical auth flow:

1. Call `tool.checkAuth()` to check current state
2. If `unauthenticated`, call `tool.startAuth()` to initiate the flow
3. Guide the user through the returned `instructions`
4. Re-check with `tool.checkAuth()` to confirm auth completed

## Complete Example

```ts
import { connect, discover } from "switchboard-ai-sdk";

async function main() {
  const tools = await discover();
  const available = tools.find(t => t.id === "codex");

  if (!available) {
    console.log("Codex is not available.");
    return;
  }

  const tool = await connect("codex");

  // Check auth before prompting
  const auth = await tool.checkAuth();

  if (auth.authStatus === "unauthenticated") {
    const authStart = await tool.startAuth();
    console.log("Run:", authStart.command);
    return;
  }

  // Health check
  if (!(await tool.health())) {
    console.log("Codex is not healthy.");
    return;
  }

  // Send prompt
  const result = await tool.chat(
    {
      messages: [
        { role: "user", content: "Write a function that retries a promise with exponential backoff." }
      ]
    },
    { timeoutMs: 60000 }
  );

  console.log(result.message.content);
}

main();
```
