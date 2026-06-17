# PRD: switchboard-ai-sdk

## 1. Product Summary

`switchboard-ai-sdk` is an open-source TypeScript SDK that lets apps discover and use AI tools already installed on the local machine through one consistent interface.

The product is designed for Node.js and Electron apps first. It supports direct in-process SDK usage as the primary integration path, with an optional local HTTP bridge for cases where another process or client needs access.

Today the project supports four core providers:

- Codex
- Claude Code
- Ollama
- OpenCode

## 2. One-Liner

Connect your app to local AI tools through one SDK.

## 3. Product Description

Developers increasingly have useful AI tools already running locally or available through local CLIs, but each tool exposes a different interface, setup flow, auth model, and request shape.

`switchboard-ai-sdk` normalizes those differences so an app can:

- discover what is available on the current machine
- inspect provider capabilities and model availability
- connect to a specific provider or connect by capability
- send chat-style requests through a consistent API
- perform health checks before use
- handle auth-gated providers in a predictable way

The primary product experience is direct SDK usage inside a Node.js or Electron environment. The optional HTTP server exists to expose the same local capability across process boundaries.

## 4. Target Users

Primary target users:

- Electron developers
- Node.js app developers
- Desktop app developers with local Node access
- Indie developers building local-first AI features
- Developers who want to reuse installed AI tools instead of paying for hosted APIs
- Developer-tool builders who want one abstraction over multiple local AI providers

Secondary target users:

- Tauri developers using a Node sidecar or bridge
- CLI tool developers
- Internal tools teams building AI-powered workflows
- Open-source app maintainers who want optional AI integrations

## 5. Problem

Local AI tooling is fragmented.

Each provider differs across:

- discovery mechanism
- install and auth flow
- model selection
- runtime assumptions
- request and response format
- error behavior

That fragmentation creates practical problems:

- apps need custom logic per provider
- apps do not know which tools are actually available
- auth failures are inconsistent and hard to interpret
- model discovery is provider-specific
- switching between providers requires glue code
- teams fall back to hosted APIs even when users already have usable local tools

## 6. Product Goal

Make local AI tools easy to integrate into apps through one developer-friendly SDK.

The project should let a developer:

- discover available local AI providers
- understand what each provider supports
- choose a provider by id or by capability
- send requests through a consistent interface
- check health and auth state before use
- add AI features without building provider-specific wrappers

## 7. Non-Goals

The current project does not aim to:

- replace Codex, Claude Code, Ollama, or OpenCode
- be a full agent framework
- provide hosted inference
- train or serve models itself
- hide all provider differences
- support every desktop framework equally today
- define a universal abstraction for every future AI tool

## 8. Positioning

### Primary Positioning

`switchboard-ai-sdk` is the local-first SDK for connecting apps to AI tools already installed on the machine.

### Supporting Positioning

- Direct SDK first, local HTTP bridge second
- One integration path across local AI agents and runtimes
- Reuse installed AI tools instead of forcing a cloud provider
- Add AI features without writing provider-specific glue code
- Discover providers, models, health, and auth state from one package

## 9. Core Product Principles

- Direct SDK usage is the default experience
- Provider behavior should be normalized, not obscured
- Tool identity and capabilities should remain explicit
- Auth, availability, and timeout failures should be easy to reason about
- The API should feel familiar to developers used to provider SDKs
- Dangerous or agentic behavior should not be hidden behind vague abstractions

## 10. Current Product Surface

### Direct SDK API

The main integration path is an in-process SDK for Node.js and Electron apps.

Current top-level API:

- `configure(config)`
- `discover()`
- `connect(providerId | { capability, prefer? })`
- connected tool methods such as `chat()`, `health()`, `checkAuth()`, and `startAuth()` where supported

### Optional Local HTTP Bridge

The package can also start a local HTTP server for process-boundary use cases.

Current server entrypoint:

- `startSwitchboardServer(options)`

Current endpoints:

- `GET /health`
- `GET /health/:toolId`
- `GET /discover`
- `POST /auth/:toolId`
- `POST /chat/:toolId`

### Configuration Layer

The SDK supports provider-specific configuration through `configure()` and environment variables.

Current config fields:

- `ollamaHost`
- `ollamaModel`
- `codexModel`
- `codexSandbox`
- `claudeCodeModel`
- `claudeCodeMaxTurns`
- `opencodeModel`

## 11. Current Provider Support

### Codex

Type: agent

Current role in the product:

- coding and agent-style local AI provider
- CLI-backed provider with auth-aware flows

Current notable behavior:

- can be discovered through the local CLI
- supports chat-style requests through the normalized SDK interface
- supports health checks
- supports auth status checks and auth start flow
- supports configured default model selection
- supports sandbox mode configuration

### Claude Code

Type: agent

Current role in the product:

- coding and agent-style local AI provider through the Claude CLI

Current notable behavior:

- can be discovered through the local CLI
- supports chat-style requests through the normalized SDK interface
- supports health checks
- supports auth status checks and auth start flow
- supports configured default model selection

### Ollama

Type: runtime

Current role in the product:

- local model runtime for chat-first use cases

Current notable behavior:

- discovers available local models
- exposes discovered and configured default models
- supports chat requests
- supports health checks
- does not require a separate auth flow
- can target a configured non-default host

### OpenCode

Type: agent

Current role in the product:

- coding and agent-style local AI provider with local and hosted model options

Current notable behavior:

- can be discovered through the local CLI
- supports chat-style requests through the normalized SDK interface
- supports health checks
- supports auth status checks and auth start flow
- supports model discovery and configured model override
- can be used with free or paid hosted model backends exposed through OpenCode

## 12. Capability Model

The SDK exposes a normalized capability layer so apps can pick tools by behavior instead of hard-coding provider names.

Current capability examples include:

- `chat`
- `completion`
- `model-list`
- `agent-task`
- `code-edit`
- `health-check`
- `auth`

Principle:

- capabilities help selection
- provider identity remains visible in the returned tool metadata

## 13. Developer Experience

### Primary Flow

The core flow is:

1. Discover available tools.
2. Pick a provider by id or capability.
3. Connect.
4. Call `chat()`.
5. Optionally check health or auth state before requests.

### Example SDK Flow

```ts
import { connect, discover } from "switchboard-ai-sdk";

const tools = await discover();
const toolId = tools.find((tool) => tool.available)?.id;

if (!toolId) {
  throw new Error("No local AI tool is available.");
}

const tool = await connect(toolId);
const result = await tool.chat({
  messages: [
    {
      role: "user",
      content: "Summarize the main idea in one paragraph."
    }
  ]
});
```

### Example Capability-Based Flow

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect({
  capability: "chat",
  prefer: ["ollama", "codex", "opencode"]
});
```

### Example HTTP Bridge Flow

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({ port: 3000 });
console.log(server.url);
```

## 14. Auth and Health Model

One current product differentiator is that the SDK does not treat all local providers as equally ready just because they are installed.

The product should continue to make these states explicit:

- installed and available
- unavailable
- healthy
- unhealthy
- auth supported
- authenticated
- unauthenticated
- auth status unknown

This matters because local CLI-based AI tools often fail for setup reasons that are different from runtime availability.

## 15. Error Model

The direct SDK throws typed errors rather than collapsing failures into generic exceptions.

Current error types:

- `ToolNotFoundError`
- `ToolUnavailableError`
- `ToolAuthError`
- `CapabilityNotSupportedError`
- `ProviderExecutionError`
- `TimeoutError`

Product requirement:

- errors should tell developers whether the issue is discovery, auth, timeout, unsupported capability, or provider execution failure

## 16. Security and Safety

This project connects apps to local AI tools, including agentic coding tools that may read project context or execute tool-specific workflows.

Current and ongoing security principles:

- provider type and capabilities must remain explicit
- agent-style tools should not be disguised as generic chat providers
- sandbox and execution-relevant settings should be surfaced where supported
- auth state should be inspectable before use
- the SDK should not silently expand permissions beyond provider defaults
- docs should explain the difference between passive runtimes and agentic tools

## 17. Supported Environments

Current focus:

- Node.js
- Electron main process
- local desktop app backends with Node access

Current secondary mode:

- any environment that can talk to the optional local HTTP bridge

Not the current primary focus:

- browser-only environments
- renderer-only direct usage without a safe bridge
- non-Node desktop environments without an adapter layer

## 18. Package Architecture

Current package is intentionally single-package and straightforward.

Relevant internal structure:

```txt
src/
  index.ts
  config.ts
  connect.ts
  types.ts
  discovery/
  providers/
  server/
  runtime/
  errors/
  capabilities/
```

Architecture principles:

- keep the public API small
- isolate provider-specific logic in provider modules
- separate direct SDK flows from HTTP transport concerns
- keep discovery, auth, model resolution, and execution logic composable

## 19. Success Criteria

Current-project success looks like:

- the README communicates the value in under 10 seconds
- developers can use direct SDK mode quickly in Node or Electron
- provider discovery is reliable across Codex, Claude Code, Ollama, and OpenCode
- auth-related failures are diagnosable without digging into provider internals
- model configuration works predictably
- the HTTP bridge mirrors the direct SDK behavior closely enough for process-boundary use cases

## 20. Example Use Cases

### Local-First Desktop App

A desktop app wants AI features without forcing users into a hosted API bill.

`switchboard-ai-sdk` allows the app to discover local tools and use the best available provider.

### Developer Tooling

A coding tool wants to reuse Codex, Claude Code, or OpenCode when available, while falling back to Ollama for local runtime use cases.

### Electron Main Process Integration

An Electron app wants a direct in-process AI integration path and only uses the HTTP bridge when another process needs access.

## 21. Future Direction

Likely future areas, without making them current commitments:

- more providers
- more capability coverage
- better renderer-safe and framework-specific adapters
- stronger permission and risk metadata
- clearer provider-selection policies
- broader platform ergonomics beyond the current Node/Electron-first path
