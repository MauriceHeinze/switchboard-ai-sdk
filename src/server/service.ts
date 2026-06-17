import { connect } from "../connect.js";
import { discover } from "../discovery/discover.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "../errors/errors.js";
import type {
  ChatInput,
  ConnectedTool,
  DiscoveredTool,
  ProviderId,
  ToolInvocationOptions
} from "../types.js";
import type { ChatToolOptions, ChatToolRequest, ChatToolResponse, ToolHealthResult, ToolOperationOptions } from "./types.js";
import { resolveRequestedModel } from "../providers/model-discovery.js";

function nowIsoString(): string {
  return new Date().toISOString();
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs?: number
): Promise<T> {
  if (timeoutMs === undefined) {
    return operation;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError());
    }, timeoutMs);

    operation.then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function withAbortableTimeout<T>(
  operation: (options: ToolInvocationOptions) => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  if (timeoutMs === undefined) {
    return operation({});
  }

  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);

    operation({
      signal: controller.signal,
      timeoutMs
    }).then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function getDiscoveredTool(toolId: ProviderId): Promise<DiscoveredTool> {
  const tools = await discover();
  const tool = tools.find((candidate) => candidate.id === toolId);

  if (!tool) {
    throw new ToolNotFoundError(toolId);
  }

  return tool;
}

export async function discoverTools() {
  return discover();
}

export async function checkToolHealth(
  toolId: ProviderId,
  options: ToolOperationOptions = {}
): Promise<ToolHealthResult> {
  const startedAt = Date.now();
  const checkedAt = nowIsoString();

  try {
    const discoveredTool = await withTimeout(getDiscoveredTool(toolId), options.timeoutMs);

    if (!discoveredTool.available) {
      return {
        toolId,
        status: "unavailable",
        available: false,
        version: discoveredTool.version,
        reason:
          typeof discoveredTool.metadata?.reason === "string"
            ? discoveredTool.metadata.reason
            : `${discoveredTool.name} is not available.`,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    const tool = await withTimeout(connect(toolId), options.timeoutMs);
    const healthy = await withAbortableTimeout(
      (invocationOptions) => tool.health(invocationOptions),
      options.timeoutMs
    );

    return {
      toolId,
      status: healthy ? "healthy" : "error",
      available: healthy,
      version: discoveredTool.version,
      reason: healthy ? undefined : `${discoveredTool.name} reported an unhealthy state.`,
      latencyMs: Date.now() - startedAt,
      checkedAt
    };
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        toolId,
        status: "timeout",
        available: false,
        reason: error.message,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    if (error instanceof ToolUnavailableError || error instanceof ToolAuthError) {
      return {
        toolId,
        status: "unavailable",
        available: false,
        reason: error.message,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    throw error;
  }
}

function assertToolSupportsChat(tool: ConnectedTool): void {
  if (!tool.chat) {
    throw new ProviderExecutionError(tool.id, `${tool.name} does not support chat calls.`);
  }
}

export async function chatWithTool(
  toolId: ProviderId,
  input: ChatToolRequest,
  options: ChatToolOptions = {}
): Promise<ChatToolResponse> {
  const startedAt = Date.now();
  const discoveredTool = await withTimeout(getDiscoveredTool(toolId), options.timeoutMs);

  if (!discoveredTool.available) {
    throw new ToolUnavailableError(
      toolId,
      typeof discoveredTool.metadata?.reason === "string"
        ? discoveredTool.metadata.reason
        : `${discoveredTool.name} is not available.`
    );
  }

  const tool = await withTimeout(connect(toolId), options.timeoutMs);
  assertToolSupportsChat(tool);
  const modelSelection = resolveRequestedModel(discoveredTool, input.model);
  const invocationInput = {
    ...input,
    model: modelSelection.model
  } as ChatInput;

  const result = await withAbortableTimeout(
    (invocationOptions) => tool.chat(invocationInput, invocationOptions),
    options.timeoutMs
  );

  return {
    toolId,
    type: tool.type,
    model: modelSelection.model,
    warnings: modelSelection.warnings.length > 0 ? modelSelection.warnings : undefined,
    result,
    latencyMs: Date.now() - startedAt
  };
}
