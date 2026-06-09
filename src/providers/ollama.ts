import { executeCommand } from "../runtime/execute.js";
import { ProviderExecutionError, ToolUnavailableError } from "../errors/errors.js";
import type { ProviderDefinition } from "../discovery/types.js";
import type { ConnectedTool, DiscoveredTool } from "../types.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "ollama",
  name: "Ollama",
  type: "runtime",
  capabilities: ["chat", "completion", "model-list", "health-check"]
};

export const ollamaProvider: ProviderDefinition = {
  async discover() {
    try {
      const { stdout } = await executeCommand("ollama", ["--version"]);

      return {
        ...TOOL,
        available: true,
        version: stdout || undefined
      };
    } catch {
      return {
        ...TOOL,
        available: false,
        metadata: {
          reason: "CLI not found or not ready."
        }
      };
    }
  },
  async connect(tool) {
    if (!tool.available) {
      throw new ToolUnavailableError(tool.id);
    }

    const connected: ConnectedTool = {
      id: tool.id,
      name: tool.name,
      type: tool.type,
      capabilities: tool.capabilities,
      async health() {
        return true;
      },
      async chat() {
        throw new ProviderExecutionError(
          tool.id,
          "Ollama chat execution is not implemented yet."
        );
      }
    };

    return connected;
  }
};
