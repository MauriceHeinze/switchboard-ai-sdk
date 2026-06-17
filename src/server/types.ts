import type { AgentRunInput, ChatInput, ProviderId, ToolResult, ToolType } from "../types.js";

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

export type DiscoverToolSummary = {
  name: string;
  available: boolean;
  models?: string[];
};

export type DiscoverResponse = {
  tools: DiscoverToolSummary[];
};

export type HealthResponse = ToolHealthResult;

export type CallToolRequest = AgentRunInput | ChatInput;

export type CallToolResponse = {
  toolId: ProviderId;
  type: ToolType;
  model?: string;
  warnings?: string[];
  result: ToolResult;
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
  maxTimeoutMs?: number;
};

export type StartedSwitchboardServer = {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
};
