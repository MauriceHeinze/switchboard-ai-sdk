import { connect } from "../connect.js";
import { discover } from "../discovery/discover.js";
import { providerRegistry } from "../providers/index.js";
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
  ToolAuthCheckResult,
  ToolInvocationOptions
} from "../types.js";
import type {
  ChatToolOptions,
  ChatToolRequest,
  ChatToolResponse,
  ToolAuthResponse,
  ToolHealthResult,
  ToolOperationOptions
} from "./types.js";
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

async function getConnectedTool(
  tool: DiscoveredTool,
  timeoutMs?: number
): Promise<ConnectedTool> {
  const provider = providerRegistry[tool.id];

  if (!provider) {
    throw new ToolNotFoundError(tool.id);
  }

  return withTimeout(provider.connect(tool), timeoutMs);
}

function getUnavailableReason(tool: DiscoveredTool): string {
  return typeof tool.metadata?.reason === "string"
    ? tool.metadata.reason
    : `${tool.name} is not available.`;
}

function getDefaultAuthState(tool: DiscoveredTool): ToolAuthCheckResult {
  const provider = providerRegistry[tool.id];
  const authSupported = Boolean(provider?.checkAuth || provider?.startAuth);

  return {
    authSupported,
    authenticated: authSupported ? null : null,
    authStatus: authSupported ? "unknown" : "not_supported",
    reason: authSupported
      ? "Unable to determine authentication state."
      : "This provider does not require a separate authentication flow."
  };
}

async function resolveToolAuthState(
  tool: DiscoveredTool,
  options: ToolOperationOptions = {}
): Promise<ToolAuthCheckResult> {
  const provider = providerRegistry[tool.id];

  if (!provider?.checkAuth) {
    return getDefaultAuthState(tool);
  }

  try {
    return await withAbortableTimeout(
      (invocationOptions) => provider.checkAuth!(tool, invocationOptions),
      options.timeoutMs
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error;
    }

    return {
      authSupported: true,
      authenticated: null,
      authStatus: "unknown",
      reason:
        error instanceof Error
          ? error.message
          : "Unable to determine authentication state."
    };
  }
}

async function buildToolHealthResult(
  discoveredTool: DiscoveredTool,
  options: ToolOperationOptions = {}
): Promise<ToolHealthResult> {
  const startedAt = Date.now();
  const checkedAt = nowIsoString();

  try {
    if (!discoveredTool.available) {
      const authState = getDefaultAuthState(discoveredTool);

      return {
        toolId: discoveredTool.id,
        status: "unavailable",
        available: false,
        authSupported: authState.authSupported,
        authenticated: authState.authenticated,
        authStatus: authState.authStatus,
        version: discoveredTool.version,
        reason: getUnavailableReason(discoveredTool),
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    const [tool, authState] = await Promise.all([
      getConnectedTool(discoveredTool, options.timeoutMs),
      resolveToolAuthState(discoveredTool, options)
    ]);

    if (authState.authSupported && authState.authenticated === false) {
      return {
        toolId: discoveredTool.id,
        status: "unavailable",
        available: false,
        authSupported: authState.authSupported,
        authenticated: authState.authenticated,
        authStatus: authState.authStatus,
        version: discoveredTool.version,
        reason:
          authState.reason ??
          `${discoveredTool.name} requires authentication before it can handle requests.`,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    const healthy = await withAbortableTimeout(
      (invocationOptions) => tool.health(invocationOptions),
      options.timeoutMs
    );

    return {
      toolId: discoveredTool.id,
      status: healthy ? "healthy" : "error",
      available: healthy,
      authSupported: authState.authSupported,
      authenticated: authState.authenticated,
      authStatus: authState.authStatus,
      version: discoveredTool.version,
      reason: healthy
        ? authState.reason
        : `${discoveredTool.name} reported an unhealthy state.`,
      latencyMs: Date.now() - startedAt,
      checkedAt
    };
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        toolId: discoveredTool.id,
        status: "timeout",
        available: false,
        authSupported: getDefaultAuthState(discoveredTool).authSupported,
        authenticated: null,
        authStatus: "unknown",
        version: discoveredTool.version,
        reason: error.message,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    if (error instanceof ToolUnavailableError || error instanceof ToolAuthError) {
      return {
        toolId: discoveredTool.id,
        status: "unavailable",
        available: false,
        authSupported: getDefaultAuthState(discoveredTool).authSupported,
        authenticated: false,
        authStatus: error instanceof ToolAuthError ? "unauthenticated" : "unknown",
        version: discoveredTool.version,
        reason: error.message,
        latencyMs: Date.now() - startedAt,
        checkedAt
      };
    }

    throw error;
  }
}

export async function discoverTools() {
  return discover();
}

export async function checkAllToolsHealth(
  options: ToolOperationOptions = {}
): Promise<ToolHealthResult[]> {
  const tools = await withTimeout(discover(), options.timeoutMs);

  return Promise.all(
    tools.map((tool) => buildToolHealthResult(tool, options))
  );
}

export async function checkToolHealth(
  toolId: ProviderId,
  options: ToolOperationOptions = {}
): Promise<ToolHealthResult> {
  const discoveredTool = await withTimeout(
    getDiscoveredTool(toolId),
    options.timeoutMs
  );

  return buildToolHealthResult(discoveredTool, options);
}

function assertToolSupportsChat(tool: ConnectedTool): void {
  if (!tool.chat) {
    throw new ProviderExecutionError(
      tool.id,
      `${tool.name} does not support chat calls.`
    );
  }
}

export async function startToolAuth(
  toolId: ProviderId,
  options: ToolOperationOptions = {}
): Promise<ToolAuthResponse> {
  const checkedAt = nowIsoString();
  const discoveredTool = await withTimeout(
    getDiscoveredTool(toolId),
    options.timeoutMs
  );
  const provider = providerRegistry[toolId];

  if (!provider?.startAuth) {
    return {
      toolId,
      status: "unsupported",
      authenticated: null,
      command: toolId,
      message: "This provider does not support a separate authentication flow.",
      checkedAt
    };
  }

  const result = await withAbortableTimeout(
    (invocationOptions) => provider.startAuth!(discoveredTool, invocationOptions),
    options.timeoutMs
  );

  return {
    toolId,
    status: result.status,
    authenticated: result.authenticated,
    command: result.command,
    message: result.message,
    instructions: result.instructions,
    output: result.output,
    checkedAt
  };
}

export async function chatWithTool(
  toolId: ProviderId,
  input: ChatToolRequest,
  options: ChatToolOptions = {}
): Promise<ChatToolResponse> {
  const startedAt = Date.now();
  const discoveredTool = await withTimeout(
    getDiscoveredTool(toolId),
    options.timeoutMs
  );

  if (!discoveredTool.available) {
    throw new ToolUnavailableError(toolId, getUnavailableReason(discoveredTool));
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
    warnings:
      modelSelection.warnings.length > 0 ? modelSelection.warnings : undefined,
    result,
    latencyMs: Date.now() - startedAt
  };
}
