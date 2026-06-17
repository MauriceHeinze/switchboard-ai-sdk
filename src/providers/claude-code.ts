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
  getConfiguredClaudeCodeModel,
  resolveRequestedModel
} from "./model-discovery.js";
import { chatInputToPrompt } from "./chat-prompt.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "claude-code",
  name: "Claude Code",
  type: "agent",
  capabilities: ["agent-task", "code-analysis", "code-edit", "chat", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;

type ClaudeCodeJsonOutput = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  session_id?: string;
};

async function listAvailableModels(
  config?: ProviderConfig
): Promise<string[] | undefined> {
  const configuredModel = await getConfiguredClaudeCodeModel(config);
  return configuredModel ? [configuredModel] : undefined;
}

function getMaxTurns(config?: ProviderConfig): number | undefined {
  if (
    typeof config?.claudeCodeMaxTurns === "number" &&
    Number.isFinite(config.claudeCodeMaxTurns) &&
    config.claudeCodeMaxTurns > 0
  ) {
    return Math.trunc(config.claudeCodeMaxTurns);
  }

  const raw = process.env.SWITCHBOARD_CLAUDE_CODE_MAX_TURNS?.trim();

  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildClaudeCodeArgs(
  input: { prompt: string; model?: string },
  config?: ProviderConfig
): string[] {
  const args = ["-p", "--output-format", "json", "--verbose"];

  const configuredModel = input.model;

  if (configuredModel) {
    args.push("--model", configuredModel);
  }

  const maxTurns = getMaxTurns(config);

  if (maxTurns !== undefined) {
    args.push("--max-turns", String(maxTurns));
  }

  args.push("--", input.prompt);

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

function isClaudeCodeAuthError(stderr: string): boolean {
  return /auth|login|api[_ -]?key|not logged in|unauthorized/i.test(stderr);
}

export function parseClaudeCodeJsonOutput(stdout: string): {
  message: {
    role: "assistant";
    content: string;
  };
  usage?: Record<string, number>;
} {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new ProviderExecutionError(
      TOOL.id,
      "Claude Code did not return any output."
    );
  }

  const parsed = JSON.parse(trimmed) as ClaudeCodeJsonOutput;

  if (parsed.is_error) {
    throw new ProviderExecutionError(
      TOOL.id,
      `Claude Code returned an error: ${parsed.result ?? "unknown error"}`
    );
  }

  if (typeof parsed.result !== "string" || parsed.result.length === 0) {
    throw new ProviderExecutionError(
      TOOL.id,
      "Claude Code did not return a result."
    );
  }

  const usage: Record<string, number> = {};

  if (parsed.cost_usd !== undefined) {
    usage.cost_usd = parsed.cost_usd;
  }

  if (parsed.duration_ms !== undefined) {
    usage.duration_ms = parsed.duration_ms;
  }

  if (parsed.num_turns !== undefined) {
    usage.num_turns = parsed.num_turns;
  }

  return {
    message: {
      role: "assistant",
      content: parsed.result
    },
    usage: Object.keys(usage).length > 0 ? usage : undefined
  };
}

export const claudeCodeProvider: ProviderDefinition = {
  async discover(config) {
    try {
      const { stdout } = await executeCommand("claude", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });
      const availableModels = await listAvailableModels(config);
      const configuredModel = await getConfiguredClaudeCodeModel(config);

      return {
        ...TOOL,
        available: true,
        version: stdout || undefined,
        models: availableModels,
        defaultModel: configuredModel
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
            "claude",
            buildClaudeCodeArgs({
              prompt: chatInputToPrompt(input),
              model: selection.model
            }, config),
            {
              signal: options.signal,
              timeoutMs: options.timeoutMs
            }
          );

          return parseClaudeCodeJsonOutput(stdout);
        } catch (error) {
          if (error instanceof TimeoutError) {
            throw error;
          }

          if (error instanceof ProviderExecutionError) {
            throw error;
          }

          const stderr = getProcessStderr(error);

          if (isClaudeCodeAuthError(stderr)) {
            throw new ToolAuthError(
              tool.id,
              "Claude Code requires authentication before it can handle requests."
            );
          }

          throw new ProviderExecutionError(
            tool.id,
            `Claude Code execution failed: ${toErrorMessage(error)}`
          );
        }
      }
    };

    return connected;
  }
};
