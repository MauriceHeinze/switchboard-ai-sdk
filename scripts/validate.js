import { startSwitchboardServer } from "../dist/index.js";

const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);
const prompt = "Reply with exactly OK.";

const post = (body) => ({ method: "POST", body: JSON.stringify(body) });

async function main() {
  const server = await startSwitchboardServer({ maxTimeoutMs: timeoutMs });
  const { url, token } = server;

  const call = async (label, path, options) => {
    const res = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    });

    console.log(`\n${label}`);
    console.log(JSON.stringify(await res.json(), null, 2));
  };

  try {
    await call("discover", "/discover");
    await call("health/codex", `/health/codex?timeoutMs=${timeoutMs}`);
    await call("health/ollama", `/health/ollama?timeoutMs=${timeoutMs}`);
    await call("call/codex", "/call/codex", post({ prompt, timeoutMs }));
    await call(
      "call/ollama",
      "/call/ollama",
      post({ messages: [{ role: "user", content: prompt }], timeoutMs })
    );
  } finally {
    await server.close();
  }
}

main().catch(console.error);