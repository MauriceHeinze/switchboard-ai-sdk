import { executeCommand } from "../runtime/execute.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
  ToolUnavailableError
} from "../errors/errors.js";
import type { ProviderDefinition } from "../discovery/types.js";
import type {
  ChatInput,
  ConnectedTool,
  DiscoveredTool,
  ProviderConfig,
  ToolInvocationOptions
} from "../types.js";
import {
  getConfiguredCodexModel,
  resolveRequestedModel
} from "./model-discovery.js";
import { chatInputToPrompt } from "./chat-prompt.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "codex",
  name: "Codex",
  type: "agent",
  capabilities: ["agent-task", "code-analysis", "code-edit", "chat", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;
const ALLOWED_SANDBOX_MODES = new Set([
  "read-only",
  "workspace-write",
  "danger-full-access"
]);

type CodexExecEvent = {
  type?: string;
  item?: {
    type?: string;
    text?: string;
  };
  usage?: Record<string, number>;
};

function getCodexSandboxMode(config?: ProviderConfig): string {
  const configuredMode =
    config?.codexSandbox ?? process.env.SWITCHBOARD_CODEX_SANDBOX ?? "read-only";

  return ALLOWED_SANDBOX_MODES.has(configuredMode)
    ? configuredMode
    : "read-only";
}

async function listAvailableModels(
  config?: ProviderConfig
): Promise<string[] | undefined> {
  const configuredModel = await getConfiguredCodexModel(config);
  return configuredModel ? [configuredModel] : undefined;
}

function buildCodexExecArgs(
  input: { prompt: string; model?: string },
  config?: ProviderConfig
): string[] {
  const args = [
    "exec",
    "--json",
    "--color",
    "never",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-rules",
    "--sandbox",
    getCodexSandboxMode(config)
  ];

  if (process.env.SWITCHBOARD_CODEX_IGNORE_USER_CONFIG === "true") {
    args.push("--ignore-user-config");
  }

  const configuredModel = input.model;

  if (configuredModel) {
    args.push("--model", configuredModel);
  }

  args.push(input.prompt);

  return args;
}

function toErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
}

function getProcessStderr(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string"
  ) {
    return error.stderr;
  }

  return "";
}

function isCodexAuthError(stderr: string): boolean {
  return /auth|login|api[_ -]?key/i.test(stderr);
}

export function parseCodexExecJsonOutput(stdout: string): {
  message: {
    role: "assistant";
    content: string;
  };
  usage?: Record<string, number>;
} {
  const events = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CodexExecEvent);

  const messageEvent = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
    );

  if (!messageEvent?.item?.text) {
    throw new ProviderExecutionError(
      TOOL.id,
      "Codex did not return a final agent message."
    );
  }

  const usageEvent = [...events]
    .reverse()
    .find((event) => event.type === "turn.completed" && event.usage);

  return {
    message: {
      role: "assistant",
      content: messageEvent.item.text
    },
    usage: usageEvent?.usage
  };
}

export const codexProvider: ProviderDefinition = {
  async discover(config) {
    try {
      const { stdout } = await executeCommand("codex", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });
      const availableModels = await listAvailableModels(config);
      const configuredModel = await getConfiguredCodexModel(config);

      return {
        ...TOOL,
        available: true,
        version: stdout || undefined,
        models: availableModels,
        defaultModel: configuredModel,
        metadata: {
          sandboxMode: getCodexSandboxMode(config)
        }
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
  async connect(tool, config) {
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
      async health() {
        return true;
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const selection = resolveRequestedModel(tool, input.model);
          const { stdout } = await executeCommand(
            "codex",
            buildCodexExecArgs({
              prompt: chatInputToPrompt(input),
              model: selection.model
            }, config),
            {
              signal: options.signal,
              timeoutMs: options.timeoutMs
            }
          );

          return parseCodexExecJsonOutput(stdout);
        } catch (error) {
          if (error instanceof TimeoutError) {
            throw error;
          }

          const stderr = getProcessStderr(error);

          if (isCodexAuthError(stderr)) {
            throw new ToolAuthError(
              tool.id,
              "Codex requires authentication before it can handle requests."
            );
          }

          throw new ProviderExecutionError(
            tool.id,
            `Codex execution failed: ${toErrorMessage(error)}`
          );
        }
      }
    };

    return connected;
  }
};
