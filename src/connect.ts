import {
  CapabilityNotSupportedError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
import { discover } from "./discovery/discover.js";
import { providerRegistry } from "./providers/index.js";
import type { ConnectInput, ConnectedTool, ProviderId } from "./types.js";

export async function connect(input: ConnectInput): Promise<ConnectedTool> {
  const tools = await discover();

  if (typeof input === "string") {
    const tool = tools.find((candidate) => candidate.id === input);

    if (!tool) {
      throw new ToolNotFoundError(input);
    }

    if (!tool.available) {
      throw new ToolUnavailableError(tool.id, `${tool.name} is not available.`);
    }

    return providerRegistry[tool.id].connect(tool);
  }

  const preferredOrder = input.prefer ?? [];
  const preferred = new Set<ProviderId>(preferredOrder);

  const sortedTools = [...tools].sort((left, right) => {
    const leftPreferred = preferred.has(left.id) ? 0 : 1;
    const rightPreferred = preferred.has(right.id) ? 0 : 1;

    if (leftPreferred !== rightPreferred) {
      return leftPreferred - rightPreferred;
    }

    return preferredOrder.indexOf(left.id) - preferredOrder.indexOf(right.id);
  });

  const matchedTool = sortedTools.find(
    (tool) => tool.available && tool.capabilities.includes(input.capability)
  );

  if (!matchedTool) {
    throw new CapabilityNotSupportedError(input.capability);
  }

  return providerRegistry[matchedTool.id].connect(matchedTool);
}
