import {
  chatWithTool,
  checkToolHealth,
  startToolAuth
} from "../dist/index.js";

const toolId = "codex";

async function main() {
  const health = await checkToolHealth(toolId, { timeoutMs: 10_000 });
  console.log("health:", health);

  if (health.authSupported && health.authenticated === false) {
    const auth = await startToolAuth(toolId, { timeoutMs: 10_000 });
    console.log("auth:", auth);

    if (auth.status !== "already_authenticated" && auth.status !== "started") {
      throw new Error(auth.message ?? "Codex authentication could not be started.");
    }

    return;
  }

  if (!health.available) {
    throw new Error(health.reason ?? "Codex is not available.");
  }

  const prompt = await chatWithTool(
    toolId,
    {
      messages: [
        {
          role: "user",
          content: "Reply with three short bullet points explaining what Switchboard AI does."
        }
      ]
    },
    {
      timeoutMs: 30_000
    }
  );

  console.log("prompt:", prompt.result.message.content);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
