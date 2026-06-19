import type {
  AuthStatus,
  ChatInput,
  ChatToolResponse,
  DiscoveredTool,
  ProviderId,
  ProviderConfig,
  RoutedChatOptions,
  RoutedChatResponse,
  ToolUsageLimits,
  ToolAuthStartStatus,
  ToolResult
} from "../types.js";

export type ToolHealthStatus = "healthy" | "unavailable" | "timeout" | "error";

export type ToolHealthResult = {
  toolId: ProviderId;
  status: ToolHealthStatus;
  available: boolean;
  authSupported: boolean;
  authenticated: boolean | null;
  authStatus: AuthStatus;
  usageLimits: ToolUsageLimits;
  version?: string;
  reason?: string;
  latencyMs: number;
  checkedAt: string;
};

export type DiscoverResponse = {
  tools: DiscoveredTool[];
};

export type ConfigResponse = {
  config: ProviderConfig;
};

export type UpdateConfigRequest = ProviderConfig;

export type HealthResponse = ToolHealthResult;

export type AggregateHealthResponse = {
  status: "ok";
  version: string;
  uptimeMs: number;
  tools: ToolHealthResult[];
};

export type ToolAuthResponse = {
  toolId: ProviderId;
  status: ToolAuthStartStatus;
  authenticated: boolean | null;
  command: string;
  message?: string;
  instructions?: string;
  output?: string;
  checkedAt: string;
};

export type ChatToolRequest = ChatInput;
export type { ChatToolResponse } from "../types.js";

export type ChatToolOptions = {
  timeoutMs?: number;
};

export type RoutedChatRequest = ChatInput & {
  providers: ProviderId[];
  timeoutMs?: number;
  perAttemptTimeoutMs?: number;
  retries?: number;
};

export type RoutedChatRequestOptions = RoutedChatOptions;

export type RoutedChatToolResponse = RoutedChatResponse;

export type ToolOperationOptions = {
  timeoutMs?: number;
};

export type SwitchboardServerOptions = {
  host?: string;
  port?: number;
  maxTimeoutMs?: number;
};

export type StartedSwitchboardServer = {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
};
