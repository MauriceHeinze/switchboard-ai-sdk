<p align="center">
  <img src="logo/logo_full.svg" alt="switchboard-ai-sdk logo" />
</p>

# switchboard-ai-sdk

`switchboard-ai-sdk` is a TypeScript SDK for connecting Electron apps, desktop apps, and local developer tools to AI runtimes through one API.

This is the main project overview and getting-started guide. For response shapes, endpoint payloads, and provider-specific API behavior, see [docs/API-REFERENCE.md](docs/API-REFERENCE.md). For apps that want to call the SDK directly without exposing HTTP, see [docs/SDK-USAGE.md](docs/SDK-USAGE.md).
The published npm package name is `switchboard-ai-sdk`.

It discovers and connects to local AI tools like:

- Ollama
- Codex
- Claude Code
- OpenCode

It is especially useful for developers who want to avoid paying for hosted LLM APIs and instead use local tools they already have, like Codex, Claude Code, OpenCode, or Ollama.
If you use OpenCode and do not have, or do not want to provide, a paid AI subscription, you can point it at OpenCode's free hosted models.

The goal is simple: use local AI tools through an interface that feels like a traditional LLM provider API.

## Install

```bash
npm install switchboard-ai-sdk
```

## Quick Start

If your app runs in Node.js or Electron and does not need HTTP endpoints, start with the direct SDK flow below. If you need a local HTTP bridge for another process, skip to [Run the Local HTTP Server](#run-the-local-http-server).

Discover the tools that are available on the current machine, pick one, connect, and send a prompt:

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
```

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

## Without The Server

Direct SDK usage is the default choice when your app can call local tools in-process:

- Electron main process integrations
- desktop apps with direct Node.js access
- local scripts and CLIs
- apps that want typed exceptions instead of HTTP responses

Example:

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect({
  capability: "chat",
  prefer: ["ollama", "codex", "opencode"]
});

const result = await tool.chat(
  {
    messages: [
      {
        role: "user",
        content: "Summarize the main idea in one paragraph."
      }
    ]
  },
  {
    timeoutMs: 30000
  }
);

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
const tool = await connect("codex");
```

All subsequent SDK and server calls use that config until you call `configure()` again.

See [docs/SDK-USAGE.md](docs/SDK-USAGE.md) for capability-based selection, model selection, typed error handling, health checks, and an Electron main-process example.

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

- Ollama returns installed local models.
- Codex and Claude Code return configured models when one is explicitly set.
- OpenCode can expose its available models through the CLI, and you can also set `SWITCHBOARD_OPENCODE_MODEL` directly.

For OpenCode, a practical way to think about the available models is by access tier:

| Free | Hosted `opencode-go` | OpenAI-backed |
| --- | --- | --- |
| `opencode/big-pickle` | `opencode-go/deepseek-v4-flash` | `openai/gpt-5.3-codex-spark` |
| `opencode/deepseek-v4-flash-free` | `opencode-go/deepseek-v4-pro` | `openai/gpt-5.4` |
| `opencode/mimo-v2.5-free` | `opencode-go/glm-5.1` | `openai/gpt-5.4-fast` |
| `opencode/nemotron-3-ultra-free` | `opencode-go/glm-5.2` | `openai/gpt-5.4-mini` |
| `opencode/north-mini-code-free` | `opencode-go/kimi-k2.6` | `openai/gpt-5.4-mini-fast` |
| | `opencode-go/kimi-k2.7-code` | `openai/gpt-5.5` |
| | `opencode-go/mimo-v2.5` | `openai/gpt-5.5-fast` |
| | `opencode-go/mimo-v2.5-pro` | `openai/gpt-5.5-pro` |
| | `opencode-go/minimax-m2.7` | |
| | `opencode-go/minimax-m3` | |
| | `opencode-go/qwen3.6-plus` | |
| | `opencode-go/qwen3.7-max` | |
| | `opencode-go/qwen3.7-plus` | |

## Run the Local HTTP Server

You can expose discovery and chat over HTTP:

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({
  port: 3000
});

console.log(server.url);
```

Endpoints:

- `GET /health`
- `GET /discover`
- `POST /auth/:toolId`
- `POST /chat/:toolId`
- `GET /health/:toolId`

```bash
curl http://127.0.0.1:3000/discover
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

These are optional defaults. Values passed through `configure()` take precedence until changed.

Example:

```bash
SWITCHBOARD_OPENCODE_MODEL=opencode/deepseek-v4-flash-free
```

Other valid examples:

```bash
SWITCHBOARD_OPENCODE_MODEL=opencode-go/kimi-k2.7-code
SWITCHBOARD_OPENCODE_MODEL=openai/gpt-5.5
```

## Why This Project Is Different

Many AI SDKs assume one hosted provider and a metered API bill. `switchboard-ai-sdk` is focused on local-first AI tooling on developer machines, so teams can reuse installed tools and keep a familiar provider-style integration without depending on paid remote inference for every request.

## License

MIT. See [LICENSE](LICENSE).
