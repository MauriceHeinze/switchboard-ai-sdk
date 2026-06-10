# Docs

switchboard-ai is an open-source npm package for connecting apps to local AI tools through one unified API.

This documentation area is for usage guides, provider setup notes, Electron-focused integration details, and security considerations for agentic local tools like Claude Code, Codex, and Ollama.

## Discover available models

`discover()` now returns model information when a provider can expose it.

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

- Ollama returns installed local models and the first discovered model as `defaultModel`.
- Codex returns the configured `SWITCHBOARD_CODEX_MODEL` as both `models` and `defaultModel` when it is set.
- Providers that cannot enumerate models leave these fields undefined.
