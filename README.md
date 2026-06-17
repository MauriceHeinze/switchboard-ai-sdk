<p align="center">
  <img src="logo/logo_full.svg" alt="switchboard-ai logo" />
</p>

# switchboard-ai

`switchboard-ai` is a TypeScript SDK for connecting Electron apps, desktop apps, and local developer tools to AI runtimes through one API.

It discovers and connects to local AI tools like:

- Ollama
- Codex
- Claude Code
- OpenCode

It is especially useful for developers who want to avoid paying for hosted LLM APIs and instead use local tools they already have, like Codex, Claude Code, OpenCode, or Ollama.

The goal is simple: use local AI tools through an interface that feels like a traditional LLM provider API.

## Install

```bash
npm install switchboard-ai
```

## Quick Start

Discover the tools that are available on the current machine, pick one, connect, and send a prompt:

```ts
import { connect, discover } from "switchboard-ai";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
```

This gives you a provider-style integration flow without sending every request through a paid hosted API.

If the connected tool supports prompt-style runs:

```ts
const response = await tool.run?.({
  prompt: "Summarize what this repository does in one paragraph."
});

console.log(response?.message.content);
```

If the connected tool supports chat messages:

```ts
const response = await tool.chat?.({
  messages: [
    {
      role: "user",
      content: "Summarize what this repository does in one paragraph."
    }
  ]
});

console.log(response?.message.content);
```

## Supported Providers

| Provider | Type | Typical use |
| --- | --- | --- |
| `ollama` | runtime | Local chat and local model access |
| `codex` | agent | Code analysis and code editing workflows |
| `claude-code` | agent | Agent-style coding tasks from the Claude CLI |
| `opencode` | agent | Agent-style coding tasks from the OpenCode CLI |

## Response Shape

`run()`, `chat()`, and `callTool()` all return the same result shape:

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

## Discover Models

When a provider can expose models, `discover()` returns them:

```ts
import { discover } from "switchboard-ai";

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

- Ollama returns installed local models.
- Codex, Claude Code, and OpenCode return configured models when one is explicitly set.

## Call a Provider Through the Library API

Use `callTool()` if you want one direct entrypoint that looks like a typical LLM provider call:

```ts
import { callTool } from "switchboard-ai";

const response = await callTool("codex", {
  prompt: "Summarize the public API of this package.",
  model: "gpt-5"
});

console.log(response.model);
console.log(response.result.message.content);
```

For chat-style requests:

```ts
import { callTool } from "switchboard-ai";

const response = await callTool("ollama", {
  messages: [
    {
      role: "user",
      content: "Summarize this repository in one paragraph."
    }
  ],
  model: "llama3.1"
});

console.log(response.result.message.content);
```

## Run the Local HTTP Server

You can expose discovery and tool calls over HTTP:

```ts
import { startSwitchboardServer } from "switchboard-ai";

const server = await startSwitchboardServer({
  port: 3000
});

console.log(server.url);
console.log(server.token);
```

Endpoints:

- `GET /health`
- `GET /discover`
- `POST /call/:toolId`
- `GET /health/:toolId`

Authenticated requests use a bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:3000/discover
```

## Environment Variables

Useful configuration knobs include:

- `OLLAMA_HOST`
- `SWITCHBOARD_OLLAMA_MODEL`
- `SWITCHBOARD_CODEX_MODEL`
- `SWITCHBOARD_CODEX_SANDBOX`
- `SWITCHBOARD_CLAUDE_CODE_MODEL`
- `SWITCHBOARD_CLAUDE_CODE_MAX_TURNS`
- `SWITCHBOARD_OPENCODE_MODEL`

## Repository Structure

- [docs/README.md](docs/README.md) for usage notes and API behavior
- [examples/README.md](examples/README.md) for integration examples
- [tests/README.md](tests/README.md) for test-related notes

## Why This Project Is Different

Many AI SDKs assume one hosted provider and a metered API bill. `switchboard-ai` is focused on local-first AI tooling on developer machines, so teams can reuse installed tools and keep a familiar provider-style integration without depending on paid remote inference for every request.

## License

MIT. See [LICENSE](LICENSE).
