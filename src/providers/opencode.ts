import {
  executeCommand,
  spawnInteractiveCommand
} from "../runtime/execute.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
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
import {
  alreadyAuthenticated,
  authenticatedAuth,
  extractAuthInstructions,
  failedAuth,
  startedAuth,
  unauthenticatedAuth,
  unknownAuth
} from "./auth.js";
import {
  getConfiguredModel,
  getConfiguredModelInfo,
  resolveRequestedModel
} from "./model-discovery.js";
import { chatInputToPrompt } from "./chat-prompt.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "opencode",
  name: "OpenCode",
  type: "agent",
  capabilities: ["agent-task", "code-analysis", "code-edit", "chat", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;
const AUTH_STATUS_COMMAND = ["auth", "list"] as const;
const AUTH_START_COMMAND = ["auth", "login"] as const;

type OpenCodeEvent = {
  type?: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    time?: {
      start?: number;
      end?: number;
    };
  };
  error?: {
    name?: string;
    data?: {
      message?: string;
    };
  };
};

function getConfiguredOpenCodeModel(): string | undefined {
  const config = getProviderConfig();
  return getConfiguredModel("SWITCHBOARD_OPENCODE_MODEL", config?.opencodeModel);
}

async function listAvailableModels(): Promise<string[] | undefined> {
  const config = getProviderConfig();
  const configuredModel = getConfiguredOpenCodeModel();

  try {
    const { stdout } = await executeCommand("opencode", ["models"], {
      timeoutMs: DISCOVERY_TIMEOUT_MS
    });
    const discoveredModels = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (configuredModel && !discoveredModels.includes(configuredModel)) {
      discoveredModels.unshift(configuredModel);
    }

    return discoveredModels;
  } catch {
    return getConfiguredModelInfo(
      "SWITCHBOARD_OPENCODE_MODEL",
      config?.opencodeModel
    ).models;
  }
}

export function buildOpenCodeArgs(input: { prompt: string; model?: string }): string[] {
  const args = ["run", "--format", "json"];

  const selectedModel = input.model ?? getConfiguredOpenCodeModel();

  if (selectedModel) {
    args.push("--model", selectedModel);
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

function isOpenCodeAuthError(stderr: string): boolean {
  return /auth|login|api[_ -]?key|unauthorized|not logged in/i.test(stderr);
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function getOpenCodeAuthCommand(args: readonly string[]): string {
  return ["opencode", ...args].join(" ");
}

export function parseOpenCodeAuthStatusOutput(
  output: string
): ToolAuthCheckResult {
  const command = getOpenCodeAuthCommand(AUTH_STATUS_COMMAND);
  const normalized = stripAnsi(output).trim();

  if (!normalized) {
    return unknownAuth(command, output);
  }

  if (/\b0 credentials\b/i.test(normalized)) {
    return unauthenticatedAuth(
      command,
      output,
      "OpenCode requires authentication before it can handle requests."
    );
  }

  if (/(not logged in|unauthorized|login required|no credentials)/i.test(normalized)) {
    return unauthenticatedAuth(
      command,
      output,
      "OpenCode requires authentication before it can handle requests."
    );
  }

  if (
    /(logged in|authenticated|connected|default provider.*configured)/i.test(
      normalized
    ) ||
    /\b[1-9]\d* credentials\b/i.test(normalized)
  ) {
    return authenticatedAuth(command, output, "OpenCode is authenticated.");
  }

  return unknownAuth(command, output);
}

async function checkOpenCodeAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthCheckResult> {
  try {
    const { stdout, stderr } = await executeCommand(
      "opencode",
      [...AUTH_STATUS_COMMAND],
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );

    return parseOpenCodeAuthStatusOutput([stdout, stderr].filter(Boolean).join("\n"));
  } catch (error) {
    const stderr = getProcessStderr(error);

    if (isOpenCodeAuthError(stderr)) {
      return unauthenticatedAuth(
        getOpenCodeAuthCommand(AUTH_STATUS_COMMAND),
        stderr,
        "OpenCode requires authentication before it can handle requests."
      );
    }

    return unknownAuth(
      getOpenCodeAuthCommand(AUTH_STATUS_COMMAND),
      stderr || toErrorMessage(error)
    );
  }
}

async function startOpenCodeAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthStartResult> {
  const authState = await checkOpenCodeAuth(options);
  const command = getOpenCodeAuthCommand(AUTH_START_COMMAND);

  if (authState.authenticated === true) {
    return alreadyAuthenticated(command, authState.output);
  }

  try {
    const { stdout, stderr, exitCode } = await spawnInteractiveCommand(
      "opencode",
      [...AUTH_START_COMMAND],
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        captureWindowMs: 1_500
      }
    );
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    if (/(already logged in|already authenticated|logged in)/i.test(output)) {
      return alreadyAuthenticated(command, output);
    }

    if (exitCode !== null && exitCode !== 0 && !output) {
      return failedAuth(
        command,
        "OpenCode auth command exited before starting.",
        output
      );
    }

    if (exitCode !== null && exitCode !== 0) {
      return failedAuth(command, "OpenCode auth command failed to start.", output);
    }

    return startedAuth(command, output, extractAuthInstructions(output));
  } catch (error) {
    return failedAuth(command, toErrorMessage(error));
  }
}

export function parseOpenCodeJsonOutput(stdout: string): {
  message: {
    role: "assistant";
    content: string;
  };
} {
  const events = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OpenCodeEvent);

  const errorEvent = events.find(
    (event) => event.type === "error" && event.error
  );

  if (errorEvent?.error) {
    const errorMessage =
      errorEvent.error.data?.message ??
      errorEvent.error.name ??
      "unknown error";
    throw new ProviderExecutionError(
      TOOL.id,
      `OpenCode returned an error: ${errorMessage}`
    );
  }

  const textEvents = events.filter(
    (event) =>
      event.type === "text" &&
      event.part?.type === "text" &&
      typeof event.part.text === "string" &&
      event.part.time?.end !== undefined
  );

  if (textEvents.length === 0) {
    throw new ProviderExecutionError(
      TOOL.id,
      "OpenCode did not return a text response."
    );
  }

  const content = textEvents
    .map((event) => event.part!.text!)
    .join("\n\n");

  return {
    message: {
      role: "assistant",
      content
    }
  };
}

export const opencodeProvider: ProviderDefinition = {
  async discover() {
    try {
      const { stdout } = await executeCommand("opencode", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });
      const availableModels = await listAvailableModels();
      const configuredModel = getConfiguredOpenCodeModel();

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
      async health() {
        return true;
      },
      async checkAuth(options: ToolInvocationOptions = {}) {
        return checkOpenCodeAuth(options);
      },
      async startAuth(options: ToolInvocationOptions = {}) {
        return startOpenCodeAuth(options);
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const selection = resolveRequestedModel(tool, input.model);
          const { stdout } = await executeCommand(
            "opencode",
            buildOpenCodeArgs({
              prompt: chatInputToPrompt(input),
              model: selection.model
            }),
            {
              signal: options.signal,
              timeoutMs: options.timeoutMs
            }
          );

          return parseOpenCodeJsonOutput(stdout);
        } catch (error) {
          if (error instanceof TimeoutError) {
            throw error;
          }

          if (error instanceof ProviderExecutionError) {
            throw error;
          }

          const stderr = getProcessStderr(error);

          if (isOpenCodeAuthError(stderr)) {
            throw new ToolAuthError(
              tool.id,
              "OpenCode requires authentication before it can handle requests."
            );
          }

          throw new ProviderExecutionError(
            tool.id,
            `OpenCode execution failed: ${toErrorMessage(error)}`
          );
        }
      }
    };

    return connected;
  },
  async checkAuth(_tool, options = {}) {
    return checkOpenCodeAuth(options);
  },
  async startAuth(_tool, options = {}) {
    return startOpenCodeAuth(options);
  }
};
