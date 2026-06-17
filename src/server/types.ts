import type {
  AuthStatus,
  ChatInput,
  ProviderId,
  ToolAuthStartStatus,
  ToolResult,
  ToolType
} from "../types.js";

export type ToolHealthStatus = "healthy" | "unavailable" | "timeout" | "error";

export type ToolHealthResult = {
  toolId: ProviderId;
  status: ToolHealthStatus;
  available: boolean;
  authSupported: boolean;
  authenticated: boolean | null;
  authStatus: AuthStatus;
  version?: string;
  reason?: string;
  latencyMs: number;
  checkedAt: string;
};

export type DiscoverToolSummary = {
  name: string;
  available: boolean;
  models?: string[];
};

export type DiscoverResponse = {
  tools: DiscoverToolSummary[];
};

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

export type ChatToolResponse = {
  toolId: ProviderId;
  type: ToolType;
  model?: string;
  warnings?: string[];
  result: ToolResult;
  latencyMs: number;
};

export type ChatToolOptions = {
  timeoutMs?: number;
};

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
