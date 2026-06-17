import { discover, checkToolHealth } from "../dist/index.js";

const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);

const STATUS_ICONS = {
  healthy: "\u2713",
  unavailable: "\u2717",
  timeout: "!",
  error: "\u2717"
};

function padRight(str, len) {
  return str + " ".repeat(Math.max(0, len - str.length));
}

async function main() {
  console.log("Discovering providers...\n");

  const tools = await discover();

  if (tools.length === 0) {
    console.log("No providers found.");
    return;
  }

  const nameWidth = Math.max(...tools.map((t) => t.name.length)) + 2;
  const idWidth = Math.max(...tools.map((t) => t.id.length)) + 2;

  console.log("PROVIDERS");
  console.log("─".repeat(70));
  console.log(
    `  ${padRight("Provider", nameWidth)} ${padRight("ID", idWidth)} ${padRight("Type", 10)} ${padRight("Version", 12)} Available`
  );
  console.log("─".repeat(70));

  for (const tool of tools) {
    const avail = tool.available ? "yes" : "no";
    const version = tool.version ?? "-";
    console.log(
      `  ${padRight(tool.name, nameWidth)} ${padRight(tool.id, idWidth)} ${padRight(tool.type, 10)} ${padRight(version, 12)} ${avail}`
    );
  }

  console.log();

  console.log("MODELS");
  console.log("─".repeat(70));

  for (const tool of tools) {
    const models = tool.models ?? [];
    const defaultModel = tool.defaultModel;

    if (models.length === 0) {
      console.log(`  ${tool.name}: no models listed`);
    } else {
      console.log(`  ${tool.name}:`);
      for (const model of models) {
        const marker = model === defaultModel ? " (default)" : "";
        console.log(`    - ${model}${marker}`);
      }
    }
  }

  console.log();

  console.log("HEALTH");
  console.log("─".repeat(70));

  for (const tool of tools) {
    const result = await checkToolHealth(tool.id, { timeoutMs });
    const icon = STATUS_ICONS[result.status] ?? "?";
    const latency = `${result.latencyMs}ms`;

    let line = `  ${icon} ${padRight(tool.name, nameWidth)} ${padRight(result.status, 12)} ${latency}`;

    if (result.version) {
      line += `  v${result.version}`;
    }

    if (result.reason) {
      line += `  (${result.reason})`;
    }

    console.log(line);
  }

  console.log();
}

main().catch(console.error);
