<p align="center">
  <img src="../logo/logo_full.svg" alt="switchboard-ai-sdk logo" />
</p>

# Docs

switchboard-ai-sdk is an open-source npm package for connecting apps to local AI tools through one unified API.

It is designed for developers who want an API-shaped integration but prefer to use local tools they already have instead of paying for hosted LLM APIs on every request.

This documentation area focuses on three things:

- how to connect to an available tool
- how to send a prompt
- what the response looks like

## Connect to an available tool

This is the same basic pattern you would use with a traditional provider SDK: pick a tool, connect, send a prompt, read the response.

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
```

## Send a prompt

Use `chat()` and pass the prompt as a single user message:

```ts
const response = await tool.chat?.({
  messages: [
    {
      role: "user",
      content: "Generate me a list of five healthy lunch ideas."
    }
  ]
});

console.log(response?.message.content);
```

This keeps the app flow simple: pass a prompt, get a response.

## Response shape

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

## Example responses

This is what the validator output looks like when local tools are available:

### `GET /discover`

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

## Discover available models

`discover()` now returns model information when a provider can expose it.

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

- Ollama returns installed local models and uses `SWITCHBOARD_OLLAMA_MODEL` as `defaultModel` when it is set; otherwise it falls back to the first discovered model.
- Codex, Claude Code, and OpenCode currently mirror their configured model into `models` and `defaultModel` when one is explicitly set.
- Providers without a stable machine-readable model listing mechanism leave `models` undefined when nothing is configured.

The HTTP `GET /discover` endpoint is intentionally slimmer than the library API:

- all providers return only `name` and `available`
- Ollama additionally returns `models`
