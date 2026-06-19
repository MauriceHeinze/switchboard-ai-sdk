---
title: Start the HTTP server — switchboard-ai-sdk recipe
description: Start the local HTTP bridge for switchboard-ai-sdk and call it from any process.
og:title: Start HTTP server — switchboard-ai-sdk
og:description: Expose switchboard-ai-sdk over HTTP with startSwitchboardServer().
---

# Start the HTTP server

Use the HTTP bridge when the caller is not a Node.js process.

```ts
import { startSwitchboardServer } from "switchboard-ai-sdk";

const server = await startSwitchboardServer({ port: 3000 });
console.log(server.url); // http://127.0.0.1:3000
```

## Call it with curl

```bash
curl http://127.0.0.1:3000/discover

curl -X POST http://127.0.0.1:3000/chat/ollama \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Stop the server

```ts
await server.close();
```

## Use createSwitchboardServer for more control

```ts
import { createSwitchboardServer } from "switchboard-ai-sdk";

const server = createSwitchboardServer({ port: 3000 });
server.listen(3000, "127.0.0.1");
```
