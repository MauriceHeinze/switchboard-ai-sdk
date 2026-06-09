import type { ConnectedTool, DiscoveredTool } from "../types.js";

export type ProviderDefinition = {
  discover(): Promise<DiscoveredTool>;
  connect(tool: DiscoveredTool): Promise<ConnectedTool>;
};
