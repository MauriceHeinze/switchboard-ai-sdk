---
title: Electron AI apps — switchboard-ai-sdk use case
description: Add local AI features to Electron apps using switchboard-ai-sdk. Discover installed tools and expose them through a secure main-process bridge.
og:title: Electron AI apps with switchboard-ai-sdk
og:description: Build Electron apps that use Codex, Claude Code, OpenCode, or Ollama without hosted API costs.
---

# Electron AI apps

## Problem

You want to add AI features to an Electron app, but you do not want to:

- ship API keys in your app
- pay per request for every user's AI usage
- manage billing for a hosted LLM provider

You also cannot safely expose arbitrary local AI access directly from the renderer process.

## Why normal API integration is annoying

Hosted APIs require:

- an API key stored securely (hard in a client app)
- network access on every request
- usage limits, rate limits, and billing
- a backend proxy to hide the key

Direct CLI calls from the renderer are insecure because the renderer can access untrusted web content and should not spawn local processes freely.

## How switchboard-ai-sdk solves it

switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools already installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.

Typical Electron architecture:

- **Main process** — runs switchboard-ai-sdk and the optional HTTP bridge
- **Renderer process** — calls the local HTTP bridge through a preload script
- **User** — brings their own installed AI tools

## Minimal code example

Main process:

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({ port: 0 });

mainWindow.webContents.on("did-finish-load", () => {
  mainWindow.webContents.send("switchboard-ready", server.url);
});
```

Preload bridge:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("switchboard", {
  getUrl: () => ipcRenderer.invoke("switchboard:url"),
});
```

Renderer:

```ts
const url = await window.switchboard.getUrl();

const res = await fetch(`${url}/chat/ollama`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello from Electron!" }],
  }),
});

const data = await res.json();
console.log(data.result.message.content);
```

## Limitations

- Browser-only Electron windows without Node integration cannot use the direct SDK
- You must keep the HTTP bridge on localhost and avoid exposing it to the network
- Agent tools like Codex can read and write files; inform users before connecting
