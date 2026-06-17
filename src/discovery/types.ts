import type { ConnectedTool, DiscoveredTool, ProviderConfig } from "../types.js";

export type ProviderDefinition = {
  discover(config?: ProviderConfig): Promise<DiscoveredTool>;
  connect(tool: DiscoveredTool, config?: ProviderConfig): Promise<ConnectedTool>;
};
