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

- Ollama returns installed local models and uses `SWITCHBOARD_OLLAMA_MODEL` as `defaultModel` when it is set; otherwise it falls back to the first discovered model.
- Codex, Claude Code, and OpenCode currently mirror their configured model into `models` and `defaultModel` when one is explicitly set.
- Providers without a stable machine-readable model listing mechanism leave `models` undefined when nothing is configured.

The HTTP `GET /discover` endpoint is intentionally slimmer than the library API:

- all providers return only `name` and `available`
- Ollama additionally returns `models`

## Override the model per call

`callTool()` and the HTTP `/call/:toolId` endpoint accept an optional `model` field.

If the requested model is known to be unavailable and the provider has a `defaultModel`, switchboard-ai returns a warning and falls back to that default.

```ts
const response = await callTool(
  "codex",
  {
    prompt: "Summarize this repository",
    model: "gpt-5.5"
  }
);

console.log(response.model);
console.log(response.warnings ?? []);
```
