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
const AUTH_STATUS_COMMAND = ["login", "status"] as const;
const AUTH_START_COMMAND = ["login"] as const;
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

function getCodexSandboxMode(): string {
  const config = getProviderConfig();
  const configuredMode =
    config?.codexSandbox ?? process.env.SWITCHBOARD_CODEX_SANDBOX ?? "read-only";

  return ALLOWED_SANDBOX_MODES.has(configuredMode)
    ? configuredMode
    : "read-only";
}

async function listAvailableModels(): Promise<string[] | undefined> {
  const configuredModel = await getConfiguredCodexModel();
  return configuredModel ? [configuredModel] : undefined;
}

function buildCodexExecArgs(input: { prompt: string; model?: string }): string[] {
  const args = [
    "exec",
    "--json",
    "--color",
    "never",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-rules",
    "--sandbox",
    getCodexSandboxMode()
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

function getCodexAuthCommand(args: readonly string[]): string {
  return ["codex", ...args].join(" ");
}

export function parseCodexAuthStatusOutput(
  output: string
): ToolAuthCheckResult {
  const command = getCodexAuthCommand(AUTH_STATUS_COMMAND);
  const normalized = output.trim();

  if (!normalized) {
    return unknownAuth(command, output);
  }

  if (/(not logged in|logged out|login required|unauthenticated)/i.test(normalized)) {
    return unauthenticatedAuth(
      command,
      output,
      "Codex requires authentication before it can handle requests."
    );
  }

  if (/(logged in|authenticated|active session|ready)/i.test(normalized)) {
    return authenticatedAuth(command, output, "Codex is authenticated.");
  }

  return unknownAuth(command, output);
}

async function checkCodexAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthCheckResult> {
  try {
    const { stdout, stderr } = await executeCommand(
      "codex",
      [...AUTH_STATUS_COMMAND],
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );

    return parseCodexAuthStatusOutput([stdout, stderr].filter(Boolean).join("\n"));
  } catch (error) {
    const stderr = getProcessStderr(error);

    if (isCodexAuthError(stderr)) {
      return unauthenticatedAuth(
        getCodexAuthCommand(AUTH_STATUS_COMMAND),
        stderr,
        "Codex requires authentication before it can handle requests."
      );
    }

    return unknownAuth(
      getCodexAuthCommand(AUTH_STATUS_COMMAND),
      stderr || toErrorMessage(error)
    );
  }
}

async function startCodexAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthStartResult> {
  const authState = await checkCodexAuth(options);
  const command = getCodexAuthCommand(AUTH_START_COMMAND);

  if (authState.authenticated === true) {
    return alreadyAuthenticated(command, authState.output);
  }

  try {
    const { stdout, stderr, exitCode } = await spawnInteractiveCommand(
      "codex",
      [...AUTH_START_COMMAND],
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        captureWindowMs: 1_500,
        keepRunning: true
      }
    );
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    if (/(already logged in|already authenticated|logged in)/i.test(output)) {
      return alreadyAuthenticated(command, output);
    }

    if (exitCode !== null && exitCode !== 0 && !output) {
      return failedAuth(command, "Codex auth command exited before starting.", output);
    }

    if (exitCode !== null && exitCode !== 0) {
      return failedAuth(command, "Codex auth command failed to start.", output);
    }

    return startedAuth(command, output, extractAuthInstructions(output));
  } catch (error) {
    return failedAuth(command, toErrorMessage(error));
  }
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
  async discover() {
    try {
      const { stdout } = await executeCommand("codex", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });
      const availableModels = await listAvailableModels();
      const configuredModel = await getConfiguredCodexModel();

      return {
        ...TOOL,
        available: true,
        version: stdout || undefined,
        models: availableModels,
        defaultModel: configuredModel,
        metadata: {
          sandboxMode: getCodexSandboxMode()
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
        return checkCodexAuth(options);
      },
      async startAuth(options: ToolInvocationOptions = {}) {
        return startCodexAuth(options);
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const selection = resolveRequestedModel(tool, input.model);
          const { stdout } = await executeCommand(
            "codex",
            buildCodexExecArgs({
              prompt: chatInputToPrompt(input),
              model: selection.model
            }),
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
  },
  async checkAuth(_tool, options = {}) {
    return checkCodexAuth(options);
  },
  async startAuth(_tool, options = {}) {
    return startCodexAuth(options);
  }
};
