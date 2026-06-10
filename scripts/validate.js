import { startSwitchboardServer } from "../dist/index.js";

const codexPrompt =
  process.env.SWITCHBOARD_VALIDATE_CODEX_PROMPT ?? "Reply with exactly OK.";
const ollamaPrompt =
  process.env.SWITCHBOARD_VALIDATE_OLLAMA_PROMPT ?? "Reply with exactly OK.";
const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? "30000");

function truncate(value, limit = 240) {
  if (typeof value !== "string") {
    return JSON.stringify(value, null, 2);
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

async function requestJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

async function run() {
  const server = await startSwitchboardServer({
    maxTimeoutMs: timeoutMs
  });

  console.log(`Switchboard server: ${server.url}`);
  console.log(`Bearer token: ${server.token}`);

  try {
    const discover = await requestJson(`${server.url}/discover`, server.token);
    console.log("\nDiscovered tools:");
    for (const tool of discover.tools) {
      console.log(
        `- ${tool.id}: available=${tool.available} version=${tool.version ?? "n/a"}`
      );
    }

    for (const toolId of ["codex", "ollama"]) {
      try {
        const health = await requestJson(
          `${server.url}/health/${toolId}?timeoutMs=${timeoutMs}`,
          server.token
        );
        console.log(
          `\nHealth ${toolId}: status=${health.status} available=${health.available} latencyMs=${health.latencyMs}`
        );
        if (health.reason) {
          console.log(`Reason ${toolId}: ${health.reason}`);
        }
      } catch (error) {
        console.log(`\nHealth ${toolId} failed: ${error.message}`);
      }
    }

    try {
      const codexResult = await requestJson(
        `${server.url}/call/codex`,
        server.token,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: codexPrompt,
            timeoutMs
          })
        }
      );
      console.log("\nCodex call result:");
      console.log(truncate(codexResult.result));
    } catch (error) {
      console.log(`\nCodex call failed: ${error.message}`);
    }

    try {
      const ollamaResult = await requestJson(
        `${server.url}/call/ollama`,
        server.token,
        {
          method: "POST",
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: ollamaPrompt
              }
            ],
            timeoutMs
          })
        }
      );
      console.log("\nOllama call result:");
      console.log(truncate(ollamaResult.result));
    } catch (error) {
      console.log(`\nOllama call failed: ${error.message}`);
    }
  } finally {
    await server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
