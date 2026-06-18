import { connect } from "../dist/index.js";

async function main() {
  // Connect to the local Ollama provider through the unified SDK interface.
  const tool = await connect("ollama");

  // Ollama does not expose a separate auth flow in this SDK, so start with health.
  const health = await tool.health({ timeoutMs: 10_000 });
  console.log("health:", health);

  if (!health) {
    throw new Error("Ollama is not healthy.");
  }

  // Send a normal chat request once the local runtime is reachable.
  const prompt = await tool.chat(
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

  console.log("prompt:", prompt.message.content);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
