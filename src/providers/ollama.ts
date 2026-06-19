import { executeCommand } from "../runtime/execute.js";
import {
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
  ToolUnavailableError
} from "../errors/errors.js";
import { getProviderConfig } from "../config.js";
import type { ProviderDefinition } from "../discovery/types.js";
import type {
  ChatInput,
  ConnectedTool,
  DiscoveredTool,
  ToolAuthCheckResult,
  ToolAuthStartResult,
  ToolInvocationOptions
} from "../types.js";
import { notSupportedAuth, unsupportedAuth } from "./auth.js";
import {
  getConfiguredModel,
  resolveRequestedModel
} from "./model-discovery.js";
import { detectProviderFailureKind } from "./error-classification.js";

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

function normalizeOllamaChatResponse(result: OllamaChatResponse) {
  const usage: Record<string, number> = {};

  if (result.total_duration !== undefined) {
    usage.total_duration = result.total_duration;
  }

  if (result.load_duration !== undefined) {
    usage.load_duration = result.load_duration;
  }

  if (result.prompt_eval_count !== undefined) {
    usage.prompt_eval_count = result.prompt_eval_count;
  }

  if (result.prompt_eval_duration !== undefined) {
    usage.prompt_eval_duration = result.prompt_eval_duration;
  }

  if (result.eval_count !== undefined) {
    usage.eval_count = result.eval_count;
  }

  if (result.eval_duration !== undefined) {
    usage.eval_duration = result.eval_duration;
  }

  return {
    message: {
      role: "assistant" as const,
      content: result.message.content
    },
    usage: Object.keys(usage).length > 0 ? usage : undefined,
    metadata: {
      model: result.model,
      done: result.done,
      doneReason: result.done_reason,
      thinking: result.message.thinking
    }
  };
}

function getOllamaBaseUrl(): string {
  const config = getProviderConfig();
  const configuredHost = config?.ollamaHost?.trim() ?? process.env.OLLAMA_HOST?.trim();

  if (!configuredHost) {
    return DEFAULT_OLLAMA_HOST;
  }

  if (/^https?:\/\//.test(configuredHost)) {
    return configuredHost;
  }

  return `http://${configuredHost}`;
}

function getConfiguredOllamaModel(): string | undefined {
  const config = getProviderConfig();
  return getConfiguredModel("SWITCHBOARD_OLLAMA_MODEL", config?.ollamaModel);
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
    const message = `Ollama request failed with ${response.status}: ${
      body || response.statusText
    }`;

    if (response.status === 429) {
      const kind = detectProviderFailureKind(message);

      if (kind === "quota_exceeded") {
        throw new QuotaExceededError(TOOL.id, message);
      }

      throw new RateLimitError(TOOL.id, message);
    }

    throw new ProviderExecutionError(TOOL.id, message);
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
  requestedModel?: string,
  signal?: AbortSignal
): Promise<string> {
  const selection = resolveRequestedModel(tool, requestedModel);

  if (selection.model) {
    return selection.model;
  }

  const configuredModel = getConfiguredOllamaModel();

  if (configuredModel) {
    return configuredModel;
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
        const configuredModel = getConfiguredOllamaModel();

        return {
          ...TOOL,
          available: true,
          version: stdout || undefined,
          models: availableModels,
          defaultModel: configuredModel ?? availableModels[0],
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
      async checkAuth(): Promise<ToolAuthCheckResult> {
        return notSupportedAuth("ollama");
      },
      async startAuth(): Promise<ToolAuthStartResult> {
        return unsupportedAuth("ollama");
      },
      async health(options: ToolInvocationOptions = {}) {
        const models = await listOllamaModels(options.signal);
        return models.length > 0;
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const model = await resolveOllamaModel(tool, input.model, options.signal);
          const result = await requestOllama<OllamaChatResponse>(
            "/api/chat",
            {
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
            }
          );

          return normalizeOllamaChatResponse(result);
        } catch (error) {
          if (
            error instanceof TimeoutError ||
            error instanceof ToolUnavailableError ||
            error instanceof ProviderExecutionError ||
            error instanceof RateLimitError ||
            error instanceof QuotaExceededError
          ) {
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
  },
  async checkAuth() {
    return notSupportedAuth("ollama");
  },
  async startAuth() {
    return unsupportedAuth("ollama");
  }
};
