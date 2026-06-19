import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distIndexPath = path.resolve(__dirname, "../dist/index.js");
const timeoutMs = Number(process.env.SWITCHBOARD_VALIDATE_TIMEOUT_MS ?? 30000);
const requestedToolId = process.argv[2]?.trim();

function padRight(value, length) {
  return value + " ".repeat(Math.max(0, length - value.length));
}

function formatWindow(label, window) {
  return `${label}: used ${window.usedPercentage}% | remaining ${window.remainingPercentage}% | resets ${window.resetsAt}`;
}

async function loadSdk() {
  try {
    await access(distIndexPath);
  } catch {
    throw new Error(
      'Build output not found. Run "npm run build" before running this script.'
    );
  }

  return import(pathToFileURL(distIndexPath).href);
}

function printUsageLimits(usageLimits) {
  console.log(`    Usage limits: ${usageLimits.status}`);

  if (usageLimits.source) {
    console.log(`    Source: ${usageLimits.source}`);
  }

  if (usageLimits.plan) {
    console.log(`    Plan: ${usageLimits.plan}`);
  }

  const windows = usageLimits.windows ?? {};
  const lines = [];

  if (windows.five_hour) {
    lines.push(formatWindow("5h", windows.five_hour));
  }

  if (windows.seven_day) {
    lines.push(formatWindow("7d", windows.seven_day));
  }

  for (const line of lines) {
    console.log(`    ${line}`);
  }

  if (usageLimits.reason) {
    console.log(`    Reason: ${usageLimits.reason}`);
  }
}

async function main() {
  const sdk = await loadSdk();
  const allHealth = await sdk.checkAllToolsHealth({ timeoutMs });
  const tools = requestedToolId
    ? allHealth.filter((tool) => tool.toolId === requestedToolId)
    : allHealth;

  if (requestedToolId && tools.length === 0) {
    throw new Error(`Unknown provider "${requestedToolId}".`);
  }

  const toolIdWidth = Math.max(...tools.map((tool) => tool.toolId.length), 6) + 2;

  console.log("USAGE LIMITS");
  console.log("─".repeat(96));
  console.log(
    `  ${padRight("Tool", toolIdWidth)} ${padRight("Health", 14)} ${padRight("Auth", 18)} Checked`
  );
  console.log("─".repeat(96));

  for (const tool of tools) {
    console.log(
      `  ${padRight(tool.toolId, toolIdWidth)} ${padRight(tool.status, 14)} ${padRight(tool.authStatus, 18)} ${tool.checkedAt}`
    );
    printUsageLimits(tool.usageLimits);
    console.log();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
