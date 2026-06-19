---
title: Check auth before chat — switchboard-ai-sdk recipe
description: Check provider authentication before sending a chat prompt with switchboard-ai-sdk.
og:title: Check auth before chat — switchboard-ai-sdk
og:description: Avoid ToolAuthError by checking auth status and starting the auth flow before chatting.
---

# Check auth before chat

Agent providers require authentication. Check auth before sending prompts.

```ts
import { connect } from "switchboard-ai-sdk";

const tool = await connect("codex");

const auth = await tool.checkAuth();

if (auth.authStatus === "unauthenticated") {
  const start = await tool.startAuth();
  console.log("Run:", start.command);
  console.log("Instructions:", start.instructions);
  process.exit(0);
}

const result = await tool.chat({
  messages: [{ role: "user", content: "Refactor this file." }],
});

console.log(result.message.content);
```

## Generic helper

```ts
async function ensureAuth(tool) {
  if (!tool.checkAuth) return; // not an auth provider

  const auth = await tool.checkAuth();
  if (auth.authStatus === "unauthenticated") {
    const start = await tool.startAuth();
    console.log("Auth required:", start.instructions);
    throw new Error("Authentication required");
  }
}
```
