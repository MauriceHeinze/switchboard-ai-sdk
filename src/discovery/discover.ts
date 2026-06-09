import { providerRegistry } from "../providers/index.js";
import type { DiscoveredTool } from "../types.js";

export async function discover(): Promise<DiscoveredTool[]> {
  return Promise.all(
    Object.values(providerRegistry).map((provider) => provider.discover())
  );
}
