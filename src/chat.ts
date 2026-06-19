import { connect } from "./connect.js";
import { discover } from "./discovery/discover.js";
import {
  ProviderExecutionError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
import { resolveRequestedModel } from "./providers/model-discovery.js";
import type {
  ChatInput,
  ChatToolResponse,
  ConnectedTool,
  DiscoveredTool,
  ProviderId,
  ToolInvocationOptions
} from "./types.js";

function now(): number {
  return Date.now();
}

export async function getDiscoveredTool(toolId: ProviderId): Promise<DiscoveredTool> {
  const tools = await discover();
  const tool = tools.find((candidate) => candidate.id === toolId);

  if (!tool) {
    throw new ToolNotFoundError(toolId);
  }

  return tool;
}

export function assertToolSupportsChat(tool: ConnectedTool): void {
  if (!tool.chat) {
    throw new ProviderExecutionError(
      tool.id,
      `${tool.name} does not support chat calls.`
    );
  }
}

export async function executeToolChat(
  toolId: ProviderId,
  input: ChatInput,
  options: ToolInvocationOptions = {}
): Promise<ChatToolResponse> {
  const startedAt = now();
  const discoveredTool = await getDiscoveredTool(toolId);

  if (!discoveredTool.available) {
    throw new ToolUnavailableError(
      toolId,
      typeof discoveredTool.metadata?.reason === "string"
        ? discoveredTool.metadata.reason
        : `${discoveredTool.name} is not available.`
    );
  }

  const tool = await connect(toolId);
  assertToolSupportsChat(tool);
  const modelSelection = resolveRequestedModel(discoveredTool, input.model);
  const invocationInput = {
    ...input,
    model: modelSelection.model
  } as ChatInput;
  const result = await tool.chat(invocationInput, options);

  return {
    toolId,
    type: tool.type,
    model: modelSelection.model,
    warnings:
      modelSelection.warnings.length > 0 ? modelSelection.warnings : undefined,
    result,
    latencyMs: now() - startedAt
  };
}
