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

Use it when you want one integration layer for:

- local LLMs in Electron
- desktop app AI features
- agentic coding tools on a developer machine
- model discovery across multiple local AI providers
- switching between Ollama, Codex, Claude Code, and OpenCode without rewriting your app

## Install

```bash
npm install switchboard-ai
```

## What It Does

`switchboard-ai` gives you a unified way to:

- discover which AI tools are available on the current machine
- connect to a specific provider or to the first provider with a required capability
- run agent-style tasks with tools like Codex, Claude Code, and OpenCode
- chat with local Ollama models
- expose the same functionality over a local HTTP server

## Quick Start

Discover installed tools:

```ts
import { discover } from "switchboard-ai";

const tools = await discover();

console.log(tools);
```

Connect by provider:

```ts
import { connect } from "switchboard-ai";

const ollama = await connect("ollama");

const result = await ollama.chat?.({
  messages: [
    {
      role: "user",
      content: "Summarize what this repository does in one paragraph."
    }
  ]
});

console.log(result);
```

Connect by capability:

```ts
import { connect } from "switchboard-ai";

const tool = await connect({
  capability: "code-analysis",
  prefer: ["codex", "claude-code", "opencode"]
});

const result = await tool.run?.({
  prompt: "Review the current repository structure and suggest three improvements."
});

console.log(result);
```

## Supported Providers

| Provider | Type | Typical use |
| --- | --- | --- |
| `ollama` | runtime | Local chat and local model access |
| `codex` | agent | Code analysis and code editing workflows |
| `claude-code` | agent | Agent-style coding tasks from the Claude CLI |
| `opencode` | agent | Agent-style coding tasks from the OpenCode CLI |

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

Use `callTool()` if you want one direct entrypoint:

```ts
import { callTool } from "switchboard-ai";

const response = await callTool("codex", {
  prompt: "Summarize the public API of this package.",
  model: "gpt-5"
});

console.log(response.model);
console.log(response.result);
```

For Ollama chat:

```ts
import { callTool } from "switchboard-ai";

const response = await callTool("ollama", {
  messages: [
    {
      role: "user",
      content: "Explain the difference between agent-task and chat capabilities."
    }
  ],
  model: "llama3.1"
});

console.log(response.result);
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

## Use Cases

Common ways to use `switchboard-ai`:

- Add local AI to an Electron app without binding your UI to one provider.
- Build a desktop app that prefers Ollama locally but can fall back to developer-oriented agent tools.
- Detect which coding assistant is installed on a user's machine and adapt automatically.
- Provide one integration layer for model discovery, health checks, and local tool execution.

## Repository Structure

- [docs/README.md](docs/README.md) for usage notes and API behavior
- [examples/README.md](examples/README.md) for integration examples
- [tests/README.md](tests/README.md) for test-related notes

## Why This Project Is Different

Many AI SDKs assume one hosted provider. `switchboard-ai` is for local-first AI tooling on developer machines:

- local model discovery
- CLI-based coding agents
- Electron and desktop app integration
- one TypeScript API across multiple local AI runtimes

## License

MIT. See [LICENSE](LICENSE).
