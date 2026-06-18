import { connect } from "../dist/index.js";

async function main() {
  // Connect to the local Codex provider through the unified SDK interface.
  const tool = await connect("codex");

  // Check whether Codex is ready to accept requests before sending a prompt.
  const auth = await tool.checkAuth?.({ timeoutMs: 10_000 }); // Timeout is optional

  console.log("auth:", auth);

  if (auth?.authSupported && auth.authenticated === false) {
    // Start the interactive login flow if this machine is not authenticated yet.
    const started = await tool.startAuth?.({ timeoutMs: 10_000 }); // Timeout is optional
    console.log("startAuth:", started);

    if (
      started?.status !== "already_authenticated" &&
      started?.status !== "started"
    ) {
      throw new Error(
        started?.message ?? "Codex authentication could not be started."
      );
    }

    return;
  }

  // Run a lightweight health check so the example fails early on broken setups.
  const health = await tool.health({ timeoutMs: 10_000 }); // Timeout is optional
  console.log("health:", health);

  if (!health) {
    throw new Error("Codex is not healthy.");
  }

  // Send a normal chat request once auth and health checks have passed.
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
      timeoutMs: 30_000 // Optional
    }
  );

  console.log("prompt:", prompt.message.content);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
