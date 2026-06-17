import type {
  ConnectedTool,
  DiscoveredTool,
  ToolAuthCheckResult,
  ToolAuthStartResult,
  ToolInvocationOptions
} from "../types.js";

export type ProviderDefinition = {
  discover(): Promise<DiscoveredTool>;
  connect(tool: DiscoveredTool): Promise<ConnectedTool>;
  checkAuth?(
    tool: DiscoveredTool,
    options?: ToolInvocationOptions
  ): Promise<ToolAuthCheckResult>;
  startAuth?(
    tool: DiscoveredTool,
    options?: ToolInvocationOptions
  ): Promise<ToolAuthStartResult>;
};
