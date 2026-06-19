---
title: Troubleshooting — switchboard-ai-sdk
description: Fix common switchboard-ai-sdk errors including ToolNotFoundError, ToolAuthError, ProviderExecutionError, TimeoutError, and provider-specific issues.
og:title: Troubleshooting switchboard-ai-sdk
og:description: Diagnose and fix ToolNotFoundError, ToolUnavailableError, ToolAuthError, ProviderExecutionError, TimeoutError, and provider setup problems.
---

# Troubleshooting

## No local AI tool available

**Symptom:** `discover()` returns no available tools.

**Fix:**

1. Install at least one supported provider:
   - [Codex](https://github.com/openai/codex)
   - [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
   - [Ollama](https://ollama.com)
   - [OpenCode](https://opencode.ai)
2. Make sure the CLI or server is in the user's `PATH`
3. For Ollama, ensure the server is running (`ollama serve`)

## ToolNotFoundError

**Symptom:** `connect("codex")` throws `ToolNotFoundError`.

**Fix:**

- The provider CLI is not installed
- The CLI is not on `PATH`
- You passed an invalid provider id. Valid ids: `codex`, `claude-code`, `opencode`, `ollama`

## ToolUnavailableError

**Symptom:** Provider is installed but `connect()` or `health()` fails.

**Fix:**

- Restart the provider CLI or server
- For Ollama, check the host URL and that the server is running
- Check that the provider process is not stuck or waiting for input

## ToolAuthError

**Symptom:** Chat fails with `ToolAuthError`.

**Fix:**

1. Call `tool.checkAuth()`
2. If `unauthenticated`, call `tool.startAuth()`
3. Run the returned command and follow the instructions
4. Re-check auth before chatting

## ProviderExecutionError

**Symptom:** Provider accepted the request but returned an error or malformed output.

**Fix:**

- Check the provider-specific error in the exception message
- Verify the model name is valid for the provider
- Try a shorter or simpler prompt
- Update the provider CLI to the latest version

## TimeoutError

**Symptom:** Request exceeded the timeout.

**Fix:**

- Increase `timeoutMs`:
  ```ts
  await tool.chat(input, { timeoutMs: 120000 });
  ```
- Agent tools may need 60–120 seconds for complex tasks
- Check that the provider is healthy with `tool.health()`

## Codex not authenticated

**Fix:**

```ts
const start = await tool.startAuth();
console.log(start.command);      // e.g. "codex login"
console.log(start.instructions);
```

Run the command in a terminal and complete the device/auth flow.

## Claude Code not found

**Fix:**

- Install Claude Code from the [official docs](https://docs.anthropic.com/en/docs/claude-code)
- Make sure `claude` is on `PATH`
- Restart your terminal after installation

## OpenCode model not available

**Fix:**

- Verify the model name with `opencode models` or the [OpenCode docs](https://opencode.ai/docs/models/)
- Use a free model if you do not have a paid subscription:
  - `opencode/deepseek-v4-flash-free`
  - `opencode/mimo-v2.5-free`
- Configure the model explicitly:
  ```ts
  configure({ opencodeModel: "opencode/deepseek-v4-flash-free" });
  ```

## Ollama server not running

**Fix:**

```bash
ollama serve
```

Or start Ollama through the desktop app. Then verify:

```bash
curl http://127.0.0.1:11434/api/tags
```

If Ollama runs on a different host, configure it:

```ts
configure({ ollamaHost: "http://192.168.1.20:11434" });
```

## HTTP server returns 401

**Fix:** The provider requires authentication. Call the `/auth/:toolId` endpoint and complete the flow before calling `/chat/:toolId`.

## HTTP server returns 503

**Fix:** The provider is installed but not reachable. Check that it is running and healthy.

## Still stuck?

Open an issue on [GitHub](https://github.com/MauriceHeinze/switchboard-ai-sdk/issues) with:

- The provider id
- The exact error class and message
- Output of `discover()`
- Provider version
