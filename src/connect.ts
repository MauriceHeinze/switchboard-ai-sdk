import {
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
import { discover } from "./discovery/discover.js";
import { providerRegistry } from "./providers/index.js";
import type { ConnectedTool, ProviderId } from "./types.js";

export async function connect(input: ProviderId): Promise<ConnectedTool> {
  const tools = await discover();
  const tool = tools.find((candidate) => candidate.id === input);

  if (!tool) {
    throw new ToolNotFoundError(input);
  }

  if (!tool.available) {
    throw new ToolUnavailableError(tool.id, `${tool.name} is not available.`);
  }

  return providerRegistry[tool.id].connect(tool);
}
