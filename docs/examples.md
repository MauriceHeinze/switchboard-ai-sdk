---
title: Examples — switchboard-ai-sdk
description: Real-world code examples for switchboard-ai-sdk. Covers SDK usage with OpenCode, Claude Code, Codex, Ollama, and provider functions.
og:title: switchboard-ai-sdk Code Examples
og:description: Practical examples for using switchboard-ai-sdk with OpenCode, Claude Code, Codex, and Ollama. Includes chat, function calls, and configuration patterns.
---

# Examples

## OpenCode Integration

The simplest path — just discover, connect, and chat:

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const opencode = tools.find((t) => t.id === "opencode");

if (!opencode || !opencode.available) {
  console.log("OpenCode is not available.");
  process.exit(1);
}

const tool = await connect("opencode");

const response = await tool.chat({
  messages: [
    {
      role: "user",
      content:
        "Write a JavaScript function that capitalizes the first letter of every word in a string.",
    },
  ],
});

console.log(response.message.content);
```

[View full example →](https://github.com/MauriceHeinze/switchboard-ai-sdk/blob/main/examples/simple-example-opencode.js)

## Claude Code Direct SDK Example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  claudeCodeModel: "claude-sonnet-4",
  claudeCodeMaxTurns: 2,
});

const tool = await connect("claude-code");

const response = await tool.chat({
  messages: [
    {
      role: "user",
      content:
        "Write a TypeScript utility type that makes all properties of an object optional, deeply (recursively).",
    },
  ],
});

console.log(response.message.content);
```

[View full example →](https://github.com/MauriceHeinze/switchboard-ai-sdk/blob/main/examples/claude-functions.js)

## Codex Direct SDK Example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  codexModel: "gpt-5.5",
  codexSandbox: "workspace-write",
});

const tool = await connect("codex");

const response = await tool.chat({
  messages: [
    {
      role: "user",
      content:
        "Analyze the following and suggest three improvements for performance and readability.",
    },
  ],
});

console.log(response.message.content);
```

[View full example →](https://github.com/MauriceHeinze/switchboard-ai-sdk/blob/main/examples/codex-functions.js)

## Ollama Direct SDK Example

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  ollamaModel: "qwen3:14b",
});

const tool = await connect("ollama");

const response = await tool.chat({
  messages: [
    {
      role: "user",
      content: "Explain the concept of dependency injection in simple terms.",
    },
  ],
});

console.log(response.message.content);
```

[View full example →](https://github.com/MauriceHeinze/switchboard-ai-sdk/blob/main/examples/ollama-functions.js)

## Full Workflow with Error Handling

```ts
import {
  connect,
  discover,
  ToolAuthError,
  TimeoutError,
  ToolUnavailableError
} from "switchboard-ai-sdk";

async function askAI(prompt: string) {
  const tools = await discover();

  const available = tools.find(
    (t) => t.available && t.capabilities.includes("chat")
  );

  if (!available) {
    throw new Error("No AI tools available. Install Codex, Claude Code, Ollama, or OpenCode.");
  }

  const tool = await connect(available.id);

  // Check auth for agent tools
  if (tool.checkAuth) {
    const auth = await tool.checkAuth();
    if (auth.authStatus === "unauthenticated") {
      const start = await tool.startAuth();
      console.log(`Auth required. Run: ${start.command}`);
      console.log(`Instructions: ${start.instructions}`);
      return null;
    }
  }

  // Health check
  if (!(await tool.health())) {
    throw new Error(`${tool.name} is not healthy.`);
  }

  try {
    const result = await tool.chat(
      { messages: [{ role: "user", content: prompt }] },
      { timeoutMs: 30000 }
    );
    return result.message.content;
  } catch (err) {
    if (err instanceof ToolAuthError) {
      console.log("Auth error — please authenticate first.");
    } else if (err instanceof TimeoutError) {
      console.log("Request timed out. Try again or use a shorter prompt.");
    } else if (err instanceof ToolUnavailableError) {
      console.log("Tool is currently unavailable. Try restarting it.");
    } else {
      throw err;
    }
    return null;
  }
}

// Usage
const answer = await askAI("What is the capital of France?");
console.log(answer);
```

## HTTP Server in an Electron App

```ts
// main process
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({ port: 3000 });

// Expose the URL to the renderer
mainWindow.webContents.on("did-finish-load", () => {
  mainWindow.webContents.send("switchboard-ready", server.url);
});
```

```ts
// renderer process (via preload bridge)
const response = await fetch("http://127.0.0.1:3000/chat/ollama", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello from Electron!" }],
  }),
});

const data = await response.json();
console.log(data.result.message.content);
```
