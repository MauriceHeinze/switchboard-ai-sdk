---
title: Error Handling — switchboard-ai-sdk
description: Complete guide to error handling in switchboard-ai-sdk. Typed SDK errors and HTTP error envelopes with status code mappings.
og:title: Error Handling in switchboard-ai-sdk
og:description: Understand typed SDK errors (ToolNotFoundError, ToolAuthError, ProviderExecutionError, TimeoutError) and HTTP error envelope format.
---

# Error Handling

switchboard-ai-sdk surfaces errors explicitly — you always know whether the issue is discovery, auth, timeout, or provider failure.

## Direct SDK Errors

Direct SDK calls throw typed errors that you can catch and handle per error type:

```ts
import {
  ToolNotFoundError,
  ToolUnavailableError,
  ToolAuthError,
  ProviderExecutionError,
  TimeoutError
} from "switchboard-ai-sdk";
```

### Error Types

| Error Class | Meaning | When It Occurs |
|---|---|---|
| `ToolNotFoundError` | The requested provider is not known or not installed | Invalid provider ID passed to `connect()` |
| `ToolUnavailableError` | Provider is installed but currently unreachable | Provider CLI found but not responding |
| `ToolAuthError` | Provider requires authentication that hasn't been completed | Chat called before auth flow completed |
| `ProviderExecutionError` | Provider accepted the request but failed to produce output | Provider CLI error, crashed, or returned malformed output |
| `TimeoutError` | Operation exceeded the specified or default timeout | `timeoutMs` elapsed without completion |

### Handling Example

```ts
import { connect, ToolAuthError, TimeoutError } from "switchboard-ai-sdk";

async function safeChat(prompt: string) {
  const tool = await connect("codex");

  try {
    const result = await tool.chat(
      { messages: [{ role: "user", content: prompt }] },
      { timeoutMs: 30000 }
    );
    return result.message.content;
  } catch (err) {
    if (err instanceof ToolAuthError) {
      // Guide user through auth
      const authResult = await tool.startAuth();
      console.log("Please run:", authResult.command);
      return null;
    }
    if (err instanceof TimeoutError) {
      console.log("Request timed out. Try a shorter prompt or increase the timeout.");
      return null;
    }
    // ProviderExecutionError, ToolUnavailableError, etc.
    throw err;
  }
}
```

### Error Inheritance

All SDK errors extend `Error` and carry:

- `message` — Human-readable description
- `name` — The class name (e.g. `"ToolAuthError"`)
- Additional fields may be present per error type (provider-specific details)

## HTTP Error Responses

When using the HTTP server, errors are translated to JSON error envelopes with HTTP status codes:

### Error Envelope Format

```json
{
  "error": {
    "code": "tool_not_found",
    "message": "Tool 'unknown' is not supported."
  }
}
```

### Status Code Mapping

| HTTP Status | `error.code` | SDK Error Class |
|---|---|---|
| `400` | `invalid_request` | Validation error (malformed body, bad config) |
| `401` | `tool_auth_required` | `ToolAuthError` |
| `404` | `tool_not_found` | `ToolNotFoundError` |
| `502` | `provider_execution_failed` | `ProviderExecutionError` |
| `503` | `tool_unavailable` | `ToolUnavailableError` |
| `504` | `timeout` | `TimeoutError` |
| `500` | `internal_error` | Unexpected internal failure |

### Client-Side Handling

```bash
response=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/chat/codex \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hi"}]}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

case $http_code in
  200) echo "Success: $(echo "$body" | jq -r '.result.message.content')" ;;
  401) echo "Auth required: $(echo "$body" | jq -r '.error.message')" ;;
  503) echo "Tool unavailable: $(echo "$body" | jq -r '.error.message')" ;;
  504) echo "Timeout: $(echo "$body" | jq -r '.error.message')" ;;
  *)   echo "Error: $body" ;;
esac
```

## Best Practices

### Always Check Health Before Chat

```ts
const tool = await connect("codex");

if (!(await tool.health())) {
  throw new Error("Provider is not healthy");
}

const result = await tool.chat({
  messages: [{ role: "user", content: "..." }]
});
```

### Always Check Auth Before Chat (Agent Providers)

```ts
const tool = await connect("codex");

const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const authStart = await tool.startAuth();
  // Present authStart.instructions to user
  return;
}

const result = await tool.chat({
  messages: [{ role: "user", content: "..." }]
});
```

### Set Reasonable Timeouts

Agent tools (Codex, Claude Code, OpenCode) may take longer than runtime tools (Ollama):

```ts
// Agent tools — longer timeout for multi-step reasoning
const agentResult = await codex.chat(input, { timeoutMs: 120000 });

// Runtime tools — shorter timeout for direct model calls
const runtimeResult = await ollama.chat(input, { timeoutMs: 30000 });
```

### Use AbortSignal for User Cancellation

```ts
const controller = new AbortController();

// User clicks "Cancel" → abort the request
cancelButton.onclick = () => controller.abort();

const result = await tool.chat(input, { signal: controller.signal });
```
