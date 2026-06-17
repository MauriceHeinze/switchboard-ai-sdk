<p align="center">
  <img src="../logo/logo_icon.svg" alt="switchboard-ai icon" width="72" height="72" />
</p>

# Direct SDK Usage

Use `switchboard-ai-sdk` directly when your app runs in the same Node.js or Electron process as the local AI tools you want to call. This skips the HTTP server completely.

If you need a network boundary, a browser client, or a process boundary, use the server flow from [README.md](../README.md) instead.

## When To Skip The Server

Direct usage is the better fit when:

- your Electron main process or desktop app can call local CLIs directly
- you do not need HTTP endpoints for other processes
- you want the simplest possible integration path
- you want native exceptions instead of HTTP error payloads

## Basic Flow

The non-server flow has three steps:

1. Discover available tools.
2. Connect to one tool.
3. Call `chat()` on the connected tool.

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const availableTool = tools.find((tool) => tool.available);

if (!availableTool) {
  throw new Error("No supported local AI tool is available.");
}

const tool = await connect(availableTool.id);
const result = await tool.chat({
  messages: [
    {
      role: "user",
      content: "Generate five healthy lunch ideas."
    }
  ]
});

console.log(result.message.content);
```

## Provider Config

You can set provider-specific values once instead of passing them on every call:

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
const tool = await connect("ollama");
```

This config takes precedence over environment variables until you call `configure()` again.

## Request And Response Examples

This is a direct `tool.chat()` request:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Reply with a short list of 5 ideas."
    }
  ]
}
```

This is the equivalent SDK call:

```ts
const result = await tool.chat({
  messages: [
    {
      role: "user",
      content: "Reply with a short list of 5 ideas."
    }
  ]
});
```

And this is a typical `tool.chat()` response:

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

## Connect By Capability

If your app cares about behavior instead of a specific provider, connect by capability and provide a preference order:

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect({
  capability: "chat",
  prefer: ["ollama", "codex", "opencode"]
});
```

This lets the SDK choose the first available provider that supports the requested capability.

## Inspect Models Before Calling

Use `discover()` when you want to show provider and model choices in a settings UI:

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

Then pass an explicit model into `chat()`:

```ts
const result = await tool.chat({
  model: "qwen3:14b",
  messages: [
    {
      role: "user",
      content: "Summarize this document in three bullets."
    }
  ]
});
```

## Health Checks And Timeouts

Connected tools expose `health()` and accept per-call timeout options:

```ts
const healthy = await tool.health({ timeoutMs: 10_000 });

if (!healthy) {
  throw new Error(`${tool.name} is not healthy.`);
}

const result = await tool.chat(
  {
    messages: [
      {
        role: "user",
        content: "Explain the main tradeoffs in this patch."
      }
    ]
  },
  {
    timeoutMs: 30_000
  }
);
```

If you need timeout control, the request data and invocation options stay separate:

```ts
await tool.chat(
  {
    messages: [
      {
        role: "user",
        content: "Reply with a short list of 5 ideas."
      }
    ]
  },
  {
    timeoutMs: 30_000
  }
);
```

## Error Handling

Direct SDK usage throws typed errors instead of returning HTTP status codes:

- `ToolNotFoundError`
- `ToolUnavailableError`
- `CapabilityNotSupportedError`
- `ProviderExecutionError`
- `TimeoutError`
- `ToolAuthError`

```ts
import { TimeoutError, ToolUnavailableError, connect } from "switchboard-ai-sdk";

try {
  const tool = await connect("codex");
  await tool.chat(
    {
      messages: [
        {
          role: "user",
          content: "Review this repository for race conditions."
        }
      ]
    },
    {
      timeoutMs: 20_000
    }
  );
} catch (error) {
  if (error instanceof ToolUnavailableError) {
    console.error("The requested tool is not installed or not configured.");
  } else if (error instanceof TimeoutError) {
    console.error("The tool did not answer before the timeout.");
  } else {
    throw error;
  }
}
```

## Electron Main Process Example

This pattern is usually the cleanest approach for Electron apps:

```ts
import { app, ipcMain } from "electron";
import { connect, discover } from "switchboard-ai-sdk";

app.whenReady().then(async () => {
  const tools = await discover();
  const availableTool = tools.find((tool) => tool.available);

  ipcMain.handle("ai:chat", async (_event, prompt: string) => {
    if (!availableTool) {
      throw new Error("No local AI tool is available.");
    }

    const tool = await connect(availableTool.id);

    return tool.chat({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });
  });
});
```

Keep the SDK in the main process. Let the renderer talk to it through IPC instead of exposing local CLI access directly to the renderer.
