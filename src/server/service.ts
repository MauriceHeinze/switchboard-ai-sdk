import { executeToolChat, getDiscoveredTool } from "../chat.js";
import { configure, getProviderConfig } from "../config.js";
import { discover } from "../discovery/discover.js";
import { providerRegistry } from "../providers/index.js";
import {
  FallbackExhaustedError,
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "../errors/errors.js";
import { chatWithFallback } from "../routing.js";
import type {
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
  ConfigResponse,
  RoutedChatRequest,
  RoutedChatToolResponse,
  UpdateConfigRequest,
  ToolAuthResponse,
  ToolHealthResult,
  ToolOperationOptions
} from "./types.js";

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

export function getServerConfig(): ConfigResponse {
  return {
    config: getProviderConfig()
  };
}

export function updateServerConfig(config: UpdateConfigRequest): ConfigResponse {
  configure(config);

  return getServerConfig();
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
  return withAbortableTimeout(
    (invocationOptions) =>
      executeToolChat(toolId, input, {
        ...invocationOptions,
        timeoutMs: options.timeoutMs ?? invocationOptions.timeoutMs
      }),
    options.timeoutMs
  );
}

export async function chatWithFallbackRoute(
  input: RoutedChatRequest
): Promise<RoutedChatToolResponse> {
  return chatWithFallback(
    {
      messages: input.messages,
      model: input.model
    },
    {
      providers: input.providers,
      timeoutMs: input.timeoutMs,
      perAttemptTimeoutMs: input.perAttemptTimeoutMs,
      retries: input.retries
    }
  );
}
