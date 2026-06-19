---
title: Security and privacy — switchboard-ai-sdk
description: Security and privacy guide for switchboard-ai-sdk. What runs locally, what data leaves the machine, Electron security, and sandbox recommendations.
og:title: Security and privacy — switchboard-ai-sdk
og:description: Understand what runs locally, what leaves the machine, and how to use switchboard-ai-sdk securely in Electron and Node.js apps.
---

# Security and privacy

switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.

This page explains the security boundaries.

## What runs locally

- The switchboard-ai-sdk code runs inside your Node.js or Electron process
- Discovery scans the local machine for installed CLI tools and the Ollama HTTP server
- Chat requests are sent to the local provider, not to a switchboard-hosted service

## What data leaves the machine

The SDK itself does not send data to remote servers. However, the underlying provider may:

| Provider | Data destination |
|---|---|
| **Ollama** | Local inference; no network call unless the user configured a remote Ollama host |
| **Codex** | OpenAI's services when the CLI makes cloud model calls |
| **Claude Code** | Anthropic's services when the CLI makes cloud model calls |
| **OpenCode** | OpenCode-hosted or OpenAI-backed models depending on configuration |

Review each provider's privacy policy before processing sensitive data.

## What depends on the provider

- Auth state is managed by the provider CLI
- Model availability is determined by the provider
- Sandbox and file-system access are controlled by the provider
- Error messages and output formats come from the provider

## Sandbox limitations

Agent tools can read and sometimes write files:

- Codex offers sandbox modes: `read-only`, `workspace-write`, and `danger-full-access`
- Claude Code and OpenCode operate according to their own CLI behavior

Always choose the most restrictive sandbox level that still lets the tool do its job.

## Electron security recommendations

- Run switchboard-ai-sdk in the **main process**, not the renderer
- Use `contextIsolation: true` and `nodeIntegration: false`
- Expose only the minimum surface through a preload script
- Bind the HTTP bridge to `127.0.0.1` and never expose it to the network
- Validate all messages from the renderer before acting on them

Example secure preload:

```ts
contextBridge.exposeInMainWorld("switchboard", {
  getUrl: () => ipcRenderer.invoke("switchboard:url"),
});
```

## Why browser-only apps should not expose arbitrary local AI access

Browser pages can load untrusted third-party scripts. If a browser page could directly call local AI tools, malicious code could:

- read local files through agent tools
- run expensive or harmful prompts
- exfiltrate data through provider calls

Always route browser access through a trusted local backend process such as Electron's main process or a Node.js server.

## Best practices

1. Inform users before connecting to agent-capable tools
2. Default to the least permissive sandbox mode
3. Check `tool.type` and `tool.capabilities` before use
4. Never ship API keys for hosted providers inside the SDK; rely on the user's local auth
5. Keep the optional HTTP bridge on localhost only

## Reporting security issues

If you find a security issue in switchboard-ai-sdk itself, please open a private issue on [GitHub](https://github.com/MauriceHeinze/switchboard-ai-sdk/security).
