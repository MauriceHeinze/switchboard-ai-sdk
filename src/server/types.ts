import type { AgentRunInput, ChatInput, DiscoveredTool, ProviderId, ToolType } from "../types.js";

export type ToolHealthStatus = "healthy" | "unavailable" | "timeout" | "error";

export type ToolHealthResult = {
  toolId: ProviderId;
  status: ToolHealthStatus;
  available: boolean;
  version?: string;
  reason?: string;
  latencyMs: number;
  checkedAt: string;
};

export type DiscoverResponse = {
  tools: DiscoveredTool[];
};

export type HealthResponse = ToolHealthResult;

export type CallToolRequest = AgentRunInput | ChatInput;

export type CallToolResponse = {
  toolId: ProviderId;
  type: ToolType;
  result: unknown;
  latencyMs: number;
};

export type CallToolOptions = {
  timeoutMs?: number;
};

export type ToolOperationOptions = {
  timeoutMs?: number;
};

export type SwitchboardServerOptions = {
  host?: string;
  port?: number;
  token?: string;
  maxTimeoutMs?: number;
};

export type StartedSwitchboardServer = {
  host: string;
  port: number;
  token: string;
  url: string;
  close(): Promise<void>;
};
