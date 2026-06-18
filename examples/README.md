<p align="center">
  <img src="../logo/logo_icon.svg" alt="switchboard-ai icon" width="72" height="72" />
</p>

# Examples

Example integrations live here. They all follow the same core flow:

1. discover an available tool
2. connect to that tool
3. send a prompt
4. read `response.message.content`

## Codex service-function example

`codex-functions.js` shows the small direct implementation for the exported service helpers that map to:

- `auth` -> `startToolAuth("codex")`
- `health` -> `checkToolHealth("codex")`
- `prompt` -> `chatWithTool("codex", input)`

Run it after building the package:

```bash
npm run build
node examples/codex-functions.js
```
