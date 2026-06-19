---
title: API Reference — switchboard-ai-sdk
description: Complete TypeScript API reference for switchboard-ai-sdk. Top-level exports, config types, ConnectedTool interface, server endpoint types, and error classes.
og:title: switchboard-ai-sdk API Reference
og:description: Full TypeScript API documentation covering configure(), discover(), connect(), startSwitchboardServer(), typed errors, and all related types.
outline: deep
---

# API Reference

This is the complete TypeScript API reference for `switchboard-ai-sdk`. For a narrative walkthrough, start with the [Getting Started](/guide/getting-started) guide.

## Top-Level Exports

```ts
import {
  // Core SDK
  configure,
  discover,
  connect,

  // Server
  startSwitchboardServer,
  createSwitchboardServer,

  // Server functional helpers
  chatWithTool,
  checkAllToolsHealth,
  checkToolHealth,
  discoverTools,
  startToolAuth,

  // Errors
  ToolNotFoundError,
  ToolUnavailableError,
  ToolAuthError,
  ProviderExecutionError,
  TimeoutError,
} from "switchboard-ai-sdk";
```

---

## `configure(config)`

Sets process-level provider configuration. Call once at startup. Values persist until `configure()` is called again.

```ts
function configure(config: ProviderConfig): void;
```

### `ProviderConfig`

```ts
type ProviderConfig = {
  ollamaHost?: string;
  ollamaModel?: string;
  codexModel?: string;
  codexSandbox?: "read-only" | "workspace-write" | "danger-full-access";
  claudeCodeModel?: string;
  claudeCodeMaxTurns?: number;
  opencodeModel?: string;
};
```

---

## `discover()`

Scans the local machine for installed AI tools and returns metadata for each.

```ts
function discover(): Promise<DiscoveredTool[]>;
```

### `DiscoveredTool`

```ts
type DiscoveredTool = {
  id: "claude-code" | "codex" | "ollama" | "opencode";
  name: string;
  type: "agent" | "runtime" | "server" | "unknown";
  available: boolean;
  version?: string;
  capabilities: Capability[];
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
};
```

### `Capability`

```ts
type Capability =
  | "chat"
  | "completion"
  | "model-list"
  | "agent-task"
  | "code-analysis"
  | "code-edit"
  | "health-check"
  | "embeddings";
```

---

## `connect(providerId)`

Connects to a specific AI tool by provider ID.

```ts
function connect(providerId: ProviderId): Promise<ConnectedTool>;
```

### `ProviderId`

```ts
type ProviderId = "claude-code" | "codex" | "ollama" | "opencode";
```

### `ConnectedTool`

```ts
type ConnectedTool = {
  id: "claude-code" | "codex" | "ollama" | "opencode";
  name: string;
  type: "agent" | "runtime" | "server" | "unknown";
  capabilities: Capability[];
  models?: string[];
  defaultModel?: string;

  health(
    options?: ToolOperationOptions
  ): Promise<boolean>;

  checkAuth?(
    options?: ToolOperationOptions
  ): Promise<AuthCheckResult>;

  startAuth?(
    options?: ToolOperationOptions
  ): Promise<AuthStartResult>;

  chat(
    input: ChatInput,
    options?: ToolOperationOptions
  ): Promise<ToolResult>;
};
```

### `ToolOperationOptions`

```ts
type ToolOperationOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};
```

### `ChatInput`

```ts
type ChatInput = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
};
```

### `ToolResult`

```ts
type ToolResult = {
  message: {
    role: "assistant";
    content: string;
  };
  usage?: Record<string, number>;
  metadata?: Record<string, unknown>;
};
```

### Auth Check Result

```ts
type AuthCheckResult = {
  authSupported: boolean;
  authenticated: boolean | null;
  authStatus: "authenticated" | "unauthenticated" | "not_supported" | "unknown";
  reason?: string;
  command?: string;
  output?: string;
};
```

### Auth Start Result

```ts
type AuthStartResult = {
  status: "already_authenticated" | "started" | "unsupported" | "failed";
  authenticated: boolean | null;
  command: string;
  message?: string;
  instructions?: string;
  output?: string;
};
```

---

## `startSwitchboardServer(options)`

Starts a local HTTP server that exposes the SDK over HTTP.

```ts
function startSwitchboardServer(
  options: SwitchboardServerOptions
): Promise<StartedSwitchboardServer>;
```

### `SwitchboardServerOptions`

```ts
type SwitchboardServerOptions = {
  host?: string;
  port?: number;
  maxTimeoutMs?: number;
};
```

### `StartedSwitchboardServer`

```ts
type StartedSwitchboardServer = {
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
};
```

---

## `createSwitchboardServer(options)`

Creates but does not start the HTTP server. Useful when you need to configure before starting.

```ts
function createSwitchboardServer(
  options: SwitchboardServerOptions
): Server;

// The returned Node.js http.Server must be started with .listen()
const server = createSwitchboardServer({ port: 3000 });
server.listen(3000, "127.0.0.1");
```

---

## Server Endpoint Types

### `ChatToolRequest`

```ts
type ChatToolRequest = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  timeoutMs?: number;
};
```

### `ChatToolResponse`

```ts
type ChatToolResponse = {
  toolId: string;
  type: string;
  model?: string;
  warnings?: string[];
  result: ToolResult;
  latencyMs: number;
};
```

### `DiscoverResponse`

```ts
type DiscoverResponse = {
  tools: DiscoveredTool[];
};
```

### `HealthResponse`

```ts
type UsageLimits = {
  status: "available" | "not_available" | "unknown";
  source?: "local_session";
  plan?: string;
  windows?: {
    five_hour?: {
      usedPercentage: number;
      remainingPercentage: number;
      resetsAt: string;
    };
    seven_day?: {
      usedPercentage: number;
      remainingPercentage: number;
      resetsAt: string;
    };
  };
  reason?: string;
};

type HealthResponse = {
  toolId: string;
  status: "healthy" | "unavailable" | "timeout" | "error";
  available: boolean;
  authSupported: boolean;
  authenticated: boolean | null;
  authStatus: "authenticated" | "unauthenticated" | "not_supported" | "unknown";
  usageLimits: UsageLimits;
  version?: string;
  reason?: string;
  latencyMs: number;
  checkedAt: string;
};
```

### `AggregateHealthResponse`

```ts
type AggregateHealthResponse = {
  status: "ok";
  version: string;
  uptimeMs: number;
  tools: HealthResponse[];
};
```

### `ConfigResponse`

```ts
type ConfigResponse = {
  config: ProviderConfig;
};
```

### `UpdateConfigRequest`

```ts
type UpdateConfigRequest = ProviderConfig;
```

### `ToolAuthResponse`

```ts
type ToolAuthResponse = {
  toolId: string;
  status: "already_authenticated" | "started" | "unsupported" | "failed";
  authenticated: boolean | null;
  command: string;
  instructions?: string;
  output?: string;
  checkedAt: string;
};
```

---

## Error Classes

All error classes extend `Error`.

### `ToolNotFoundError`

Thrown when the requested provider ID is not known or not installed.

```ts
class ToolNotFoundError extends Error {
  constructor(toolId: string);
}
```

### `ToolUnavailableError`

Thrown when a provider is installed but currently unreachable.

```ts
class ToolUnavailableError extends Error {
  constructor(toolId: string, reason?: string);
}
```

### `ToolAuthError`

Thrown when a provider requires authentication that hasn't been completed.

```ts
class ToolAuthError extends Error {
  constructor(toolId: string, message?: string);
}
```

### `ProviderExecutionError`

Thrown when a provider accepted the request but failed to produce a valid response.

```ts
class ProviderExecutionError extends Error {
  constructor(toolId: string, reason?: string);
}
```

### `TimeoutError`

Thrown when an operation exceeds the specified or default timeout.

```ts
class TimeoutError extends Error {
  constructor(message?: string);
}
```
