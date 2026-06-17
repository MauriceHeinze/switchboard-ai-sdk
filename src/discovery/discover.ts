import { providerRegistry } from "../providers/index.js";
import type { DiscoverOptions } from "../types.js";
import type { DiscoveredTool } from "../types.js";

export async function discover(
  options: DiscoverOptions = {}
): Promise<DiscoveredTool[]> {
  return Promise.all(
    Object.values(providerRegistry).map((provider) =>
      provider.discover(options.providerConfig)
    )
  );
}
