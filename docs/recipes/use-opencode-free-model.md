---
title: Use OpenCode free model — switchboard-ai-sdk recipe
description: Use OpenCode's free hosted models with switchboard-ai-sdk without a paid subscription.
og:title: Use OpenCode free model — switchboard-ai-sdk
og:description: Configure OpenCode to use a free model like opencode/deepseek-v4-flash-free.
---

# Use OpenCode free model

OpenCode offers free hosted models that do not require a paid subscription.

```ts
import { configure, connect } from "switchboard-ai-sdk";

configure({
  opencodeModel: "opencode/deepseek-v4-flash-free"
});

const tool = await connect("opencode");

const auth = await tool.checkAuth();
if (auth.authStatus === "unauthenticated") {
  const start = await tool.startAuth();
  console.log("Run:", start.command);
  console.log(start.instructions);
  process.exit(0);
}

const result = await tool.chat({
  messages: [
    { role: "user", content: "Write a bash script that lists the 10 largest files in a directory." }
  ],
});

console.log(result.message.content);
```

## Other free models

- `opencode/big-pickle`
- `opencode/mimo-v2.5-free`
- `opencode/nemotron-3-ultra-free`
- `opencode/north-mini-code-free`
