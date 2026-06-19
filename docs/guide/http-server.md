---
title: HTTP Server — switchboard-ai-sdk
description: Expose the switchboard-ai-sdk over a local HTTP bridge. Complete endpoint reference with request/response shapes, error codes, and config management.
og:title: Local HTTP Server for switchboard-ai-sdk
og:description: Run a local HTTP bridge for AI tool discovery and chat. Covers all endpoints, request/response examples, and error handling via HTTP status codes.
---

# HTTP Server

Start a local HTTP bridge when the caller isn't a Node.js process, or when you want a process boundary between the SDK and the caller.

## Starting the Server

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({
  port: 3000
});

console.log(server.url); // http://127.0.0.1:3000
```

You can also create the server without starting it immediately:

```ts
import { createSwitchboardServer } from "switchboard-ai-sdk";

const server = createSwitchboardServer({ port: 3000 });
// Configure, add middleware, etc.
server.listen(3000, "127.0.0.1");
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/config` | Read current process-level provider config |
| `PUT` | `/config` | Replace process-level provider config |
| `GET` | `/health` | Aggregate health and auth status of all tools |
| `GET` | `/health/:toolId` | Health status of a specific tool |
| `GET` | `/discover` | Discover available AI tools |
| `POST` | `/auth/:toolId` | Start authentication for a provider |
| `POST` | `/chat` | Route a chat request across preferred providers |
| `POST` | `/chat/:toolId` | Send a chat prompt to a provider |

### `GET /config`

Returns the current process-level configuration.

```bash
curl http://127.0.0.1:3000/config
```

```json
{
  "config": {
    "codexModel": "gpt-5.5",
    "codexSandbox": "workspace-write"
  }
}
```

### `PUT /config`

Replace the current configuration. The request body becomes the new process-level config; unspecified fields are removed.

```bash
curl -X PUT http://127.0.0.1:3000/config \
  -H "content-type: application/json" \
  -d '{
    "codexModel": "gpt-5.5",
    "codexSandbox": "workspace-write"
  }'
```

```json
{
  "config": {
    "codexModel": "gpt-5.5",
    "codexSandbox": "workspace-write"
  }
}
```

### `GET /discover`

```bash
curl http://127.0.0.1:3000/discover
```

```json
{
  "tools": [
    {
      "id": "codex",
      "name": "Codex",
      "type": "agent",
      "available": true,
      "version": "1.2.3",
      "capabilities": ["agent-task", "health-check"],
      "models": ["gpt-5-codex"],
      "defaultModel": "gpt-5-codex"
    },
    {
      "id": "ollama",
      "name": "Ollama",
      "type": "runtime",
      "available": true,
      "version": "0.8.0",
      "capabilities": ["chat", "health-check"],
      "models": ["qwen3:14b"],
      "defaultModel": "qwen3:14b"
    }
  ]
}
```

### `GET /health`

Returns aggregate health status of all tools.

```bash
curl http://127.0.0.1:3000/health
```

```json
{
  "status": "ok",
  "version": "0.1.7",
  "uptimeMs": 918,
  "tools": [
    {
      "toolId": "codex",
      "status": "unavailable",
      "available": false,
      "authSupported": true,
      "authenticated": false,
      "authStatus": "unauthenticated",
      "reason": "Codex requires authentication before it can handle requests.",
      "latencyMs": 55,
      "checkedAt": "2026-06-17T12:54:44.900Z"
    }
  ]
}
```

### `GET /health/:toolId`

```bash
curl http://127.0.0.1:3000/health/codex
```

```json
{
  "toolId": "codex",
  "status": "healthy",
  "available": true,
  "authSupported": true,
  "authenticated": true,
  "authStatus": "authenticated",
  "version": "codex-cli 0.136.0",
  "latencyMs": 406,
  "checkedAt": "2026-06-17T12:54:44.900Z"
}
```

### `POST /auth/:toolId`

```bash
curl -X POST http://127.0.0.1:3000/auth/codex
```

```json
{
  "toolId": "codex",
  "status": "started",
  "authenticated": false,
  "command": "codex login",
  "instructions": "Visit https://example.com/device and enter the code shown by Codex.",
  "output": "Visit https://example.com/device and enter the code shown by Codex.",
  "checkedAt": "2026-06-17T12:54:44.900Z"
}
```

### `POST /chat/:toolId`

**Request:**

```bash
curl -X POST http://127.0.0.1:3000/chat/codex \
  -H "content-type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Reply with a short list of 5 ideas." }
    ],
    "timeoutMs": 30000
  }'
```

**Response:**

```json
{
  "toolId": "codex",
  "type": "agent",
  "model": "gpt-5.4",
  "result": {
    "message": {
      "role": "assistant",
      "content": "1. Add a lightweight onboarding flow..."
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

### `POST /chat`

Use this route when you want the server to retry and fall back across providers in the order you specify.

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H "content-type: application/json" \
  -d '{
    "providers": ["codex", "claude-code", "opencode", "ollama"],
    "messages": [
      { "role": "user", "content": "Reply with a short list of 5 ideas." }
    ],
    "retries": 1,
    "perAttemptTimeoutMs": 15000
  }'
```

```json
{
  "toolId": "ollama",
  "fallbackUsed": true,
  "attempts": [
    {
      "toolId": "codex",
      "tryIndex": 0,
      "stage": "execution",
      "outcome": "failed",
      "reason": "timeout"
    },
    {
      "toolId": "ollama",
      "tryIndex": 0,
      "stage": "execution",
      "outcome": "succeeded"
    }
  ]
}
```

## HTTP Error Responses

All errors use a consistent envelope:

```json
{
  "error": {
    "code": "tool_not_found",
    "message": "Tool 'unknown' is not supported."
  }
}
```

Error codes map to HTTP status codes:

| HTTP Status | Error Code | Meaning |
|---|---|---|
| `400` | `invalid_request` | Malformed request body or invalid config |
| `401` | `tool_auth_required` | Provider requires authentication |
| `404` | `tool_not_found` | Unknown tool ID |
| `502` | `provider_execution_failed` | Provider accepted the request but failed to produce a response |
| `503` | `tool_unavailable` | Provider is installed but not currently reachable |
| `504` | `timeout` | Operation exceeded timeout |
| `500` | `internal_error` | Unexpected server error |

## Server vs Direct SDK

Use the **direct SDK** when:
- Your app runs in Node.js or Electron
- You want typed exceptions instead of HTTP error codes
- You want in-process objects with zero serialization overhead

Use the **HTTP server** when:
- Your caller is not a Node.js process
- You need a process or network boundary
- JSON error payloads are a better fit for your caller
