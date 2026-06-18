import { connect } from "../dist/index.js";

async function main() {
  const tool = await connect("codex");
  const auth = await tool.checkAuth?.({ timeoutMs: 10_000 });

  console.log("auth:", auth);

  if (auth?.authSupported && auth.authenticated === false) {
    const started = await tool.startAuth?.({ timeoutMs: 10_000 });
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

  const health = await tool.health({ timeoutMs: 10_000 });
  console.log("health:", health);

  if (!health) {
    throw new Error("Codex is not healthy.");
  }

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
