---
title: Electron main process — switchboard-ai-sdk recipe
description: Run switchboard-ai-sdk in the Electron main process and expose it to the renderer through a preload bridge.
og:title: Electron main process — switchboard-ai-sdk
og:description: Secure Electron integration using the main process and a local HTTP bridge.
---

# Electron main process

Run switchboard-ai-sdk in the main process and expose a safe bridge to the renderer.

## Main process

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { startSwitchboardServer } from "switchboard-ai-sdk";

let serverUrl: string;

app.whenReady().then(async () => {
  const server = await startSwitchboardServer({ port: 0 });
  serverUrl = server.url;

  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: "path/to/preload.js",
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("path/to/renderer.html");
});

ipcMain.handle("switchboard:url", () => serverUrl);
```

## Preload

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("switchboard", {
  getUrl: () => ipcRenderer.invoke("switchboard:url"),
});
```

## Renderer

```ts
const url = await window.switchboard.getUrl();

const res = await fetch(`${url}/discover`);
const data = await res.json();
console.log(data.tools);
```

## Security note

Keep the server bound to localhost and never expose it to the network. Use `contextIsolation: true` and `nodeIntegration: false` in the renderer.
