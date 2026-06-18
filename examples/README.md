<p align="center">
  <img src="../logo/logo_icon.svg" alt="switchboard-ai-sdk icon" width="72" height="72" />
</p>

# Examples

Example integrations live here. They all follow the same core flow:

1. discover an available tool
2. connect to that tool
3. send a prompt
4. read `response.message.content`

## Codex direct-tool example

`codex-functions.js` shows the small direct SDK flow:

- `connect("codex")`
- `tool.checkAuth()` and `tool.startAuth()`
- `tool.health()`
- `tool.chat()`

## Claude Code direct-tool example

`claude-functions.js` follows the same direct SDK flow for Claude Code:

- `connect("claude-code")`
- `tool.checkAuth()` and `tool.startAuth()`
- `tool.health()`
- `tool.chat()`

## Ollama direct-tool example

`ollama-functions.js` shows the same direct SDK pattern for Ollama, without an auth step:

- `connect("ollama")`
- `tool.health()`
- `tool.chat()`

Run it after building the package:

```bash
npm run build
node examples/codex-functions.js
node examples/claude-functions.js
node examples/ollama-functions.js
```
