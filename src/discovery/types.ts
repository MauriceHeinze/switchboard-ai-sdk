import type {
  ConnectedTool,
  DiscoveredTool,
  ToolAuthCheckResult,
  ToolAuthStartResult,
  ToolUsageLimits,
  ToolInvocationOptions
} from "../types.js";

export type ProviderDefinition = {
  discover(): Promise<DiscoveredTool>;
  connect(tool: DiscoveredTool): Promise<ConnectedTool>;
  checkAuth?(
    tool: DiscoveredTool,
    options?: ToolInvocationOptions
  ): Promise<ToolAuthCheckResult>;
  checkUsageLimits?(
    tool: DiscoveredTool,
    options?: ToolInvocationOptions
  ): Promise<ToolUsageLimits>;
  startAuth?(
    tool: DiscoveredTool,
    options?: ToolInvocationOptions
  ): Promise<ToolAuthStartResult>;
};
