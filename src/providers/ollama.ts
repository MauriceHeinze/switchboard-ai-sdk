import { executeCommand } from "../runtime/execute.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolUnavailableError
} from "../errors/errors.js";
import type { ProviderDefinition } from "../discovery/types.js";
import type {
  ChatInput,
  ConnectedTool,
  DiscoveredTool,
  ToolInvocationOptions
} from "../types.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "ollama",
  name: "Ollama",
  type: "runtime",
  capabilities: ["chat", "completion", "model-list", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;
const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";

type OllamaTag = {
  name: string;
  model?: string;
};

type OllamaTagsResponse = {
  models?: OllamaTag[];
};

type OllamaChatResponse = {
  model: string;
  message: {
    role?: string;
    content: string;
    thinking?: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

function getOllamaBaseUrl(): string {
  const configuredHost = process.env.OLLAMA_HOST?.trim();

  if (!configuredHost) {
    return DEFAULT_OLLAMA_HOST;
  }

  if (/^https?:\/\//.test(configuredHost)) {
    return configuredHost;
  }

  return `http://${configuredHost}`;
}

async function requestOllama<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getOllamaBaseUrl()}${path}`, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError();
    }

    throw new ToolUnavailableError(
      TOOL.id,
      "Ollama is installed but its local API is not reachable."
    );
  }

  if (!response.ok) {
    const body = await response.text();

    throw new ProviderExecutionError(
      TOOL.id,
      `Ollama request failed with ${response.status}: ${body || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

async function listOllamaModels(signal?: AbortSignal): Promise<string[]> {
  const response = await requestOllama<OllamaTagsResponse>("/api/tags", {
    method: "GET",
    signal
  });

  return (response.models ?? []).map((model) => model.model ?? model.name);
}

async function resolveOllamaModel(
  tool: DiscoveredTool,
  signal?: AbortSignal
): Promise<string> {
  if (typeof process.env.SWITCHBOARD_OLLAMA_MODEL === "string") {
    return process.env.SWITCHBOARD_OLLAMA_MODEL;
  }

  const discoveredDefaultModel = tool.defaultModel;

  if (typeof discoveredDefaultModel === "string") {
    return discoveredDefaultModel;
  }

  const availableModels = await listOllamaModels(signal);

  if (availableModels.length === 0) {
    throw new ToolUnavailableError(
      tool.id,
      "Ollama is running but no local models are available."
    );
  }

  return availableModels[0];
}

export const ollamaProvider: ProviderDefinition = {
  async discover() {
    try {
      const { stdout } = await executeCommand("ollama", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });

      try {
        const availableModels = await listOllamaModels();

        return {
          ...TOOL,
          available: true,
          version: stdout || undefined,
          models: availableModels,
          defaultModel: availableModels[0],
          metadata: {
            modelSource: "discovered"
          }
        };
      } catch (error) {
        if (error instanceof ToolUnavailableError) {
          return {
            ...TOOL,
            available: false,
            version: stdout || undefined,
            metadata: {
              reason: error.message
            }
          };
        }

        throw error;
      }
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
      models: tool.models,
      defaultModel: tool.defaultModel,
      async health(options: ToolInvocationOptions = {}) {
        const models = await listOllamaModels(options.signal);
        return models.length > 0;
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const model = await resolveOllamaModel(tool, options.signal);
          const result = await requestOllama<OllamaChatResponse>("/api/chat", {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              model,
              messages: input.messages,
              stream: false,
              think: false
            }),
            signal: options.signal
          });

          return result;
        } catch (error) {
          if (error instanceof TimeoutError || error instanceof ToolUnavailableError) {
            throw error;
          }

          throw new ProviderExecutionError(
            tool.id,
            `Ollama chat execution failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    };

    return connected;
  }
};
