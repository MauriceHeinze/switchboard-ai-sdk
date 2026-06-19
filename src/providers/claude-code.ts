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
  getConfiguredClaudeCodeModel,
  resolveRequestedModel
} from "./model-discovery.js";
import {
  availableUsageLimits,
  createUsageLimitWindow,
  findLatestClaudeUsageLimits,
  findNestedRecord,
  isRecord,
  unknownUsageLimits
} from "./usage-limits.js";
import { chatInputToPrompt } from "./chat-prompt.js";
import { createProviderExecutionError } from "./error-classification.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "claude-code",
  name: "Claude Code",
  type: "agent",
  capabilities: ["agent-task", "code-analysis", "code-edit", "chat", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;
const AUTH_STATUS_COMMAND = ["auth", "status", "--json"] as const;
const AUTH_START_COMMAND = ["auth", "login", "--claudeai"] as const;

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

async function listAvailableModels(): Promise<string[] | undefined> {
  const configuredModel = await getConfiguredClaudeCodeModel();
  return configuredModel ? [configuredModel] : undefined;
}

function getMaxTurns(): number | undefined {
  const config = getProviderConfig();
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

function buildClaudeCodeArgs(input: { prompt: string; model?: string }): string[] {
  const args = ["-p", "--output-format", "json", "--verbose"];

  const configuredModel = input.model;

  if (configuredModel) {
    args.push("--model", configuredModel);
  }

  const maxTurns = getMaxTurns();

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

function getProcessStdout(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    typeof error.stdout === "string"
  ) {
    return error.stdout;
  }

  return "";
}

function isClaudeCodeAuthError(stderr: string): boolean {
  return /auth|login|api[_ -]?key|not logged in|unauthorized/i.test(stderr);
}

function getClaudeAuthCommand(args: readonly string[]): string {
  return ["claude", ...args].join(" ");
}

function parseClaudeCodeUsageLimitWindow(
  value: unknown
): ReturnType<typeof createUsageLimitWindow> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const usedPercentage = value.used_percentage;
  const resetsAt = value.resets_at;

  if (
    typeof usedPercentage !== "number" ||
    !Number.isFinite(usedPercentage) ||
    typeof resetsAt !== "number" ||
    !Number.isFinite(resetsAt)
  ) {
    return undefined;
  }

  return createUsageLimitWindow(usedPercentage, resetsAt);
}

export function parseClaudeCodeUsageLimitsSnapshot(
  value: unknown
): ReturnType<typeof availableUsageLimits> | undefined {
  const rateLimits = findNestedRecord(value, "rate_limits");

  if (!rateLimits) {
    return undefined;
  }

  const windows = {
    five_hour: parseClaudeCodeUsageLimitWindow(rateLimits.five_hour),
    seven_day: parseClaudeCodeUsageLimitWindow(rateLimits.seven_day)
  };

  if (!windows.five_hour && !windows.seven_day) {
    return undefined;
  }

  return availableUsageLimits(windows);
}

export function parseClaudeCodeAuthStatusOutput(
  output: string
): ToolAuthCheckResult {
  const command = getClaudeAuthCommand(AUTH_STATUS_COMMAND);
  const trimmed = output.trim();

  if (!trimmed) {
    return unknownAuth(command, output);
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const authenticated =
      parsed.authenticated ??
      parsed.loggedIn ??
      parsed.isAuthenticated ??
      parsed.valid;

    if (authenticated === true) {
      return authenticatedAuth(command, output, "Claude Code is authenticated.");
    }

    if (authenticated === false) {
      return unauthenticatedAuth(
        command,
        output,
        "Claude Code requires authentication before it can handle requests."
      );
    }
  } catch {
    if (/(not logged in|unauthorized|login required)/i.test(trimmed)) {
      return unauthenticatedAuth(
        command,
        output,
        "Claude Code requires authentication before it can handle requests."
      );
    }

    if (/(logged in|authenticated)/i.test(trimmed)) {
      return authenticatedAuth(command, output, "Claude Code is authenticated.");
    }
  }

  return unknownAuth(command, output);
}

async function checkClaudeCodeAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthCheckResult> {
  try {
    const { stdout, stderr } = await executeCommand(
      "claude",
      [...AUTH_STATUS_COMMAND],
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );

    return parseClaudeCodeAuthStatusOutput(
      [stdout, stderr].filter(Boolean).join("\n")
    );
  } catch (error) {
    const stdout = getProcessStdout(error);
    const stderr = getProcessStderr(error);
    const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");

    if (combinedOutput) {
      const parsed = parseClaudeCodeAuthStatusOutput(combinedOutput);

      if (parsed.authStatus !== "unknown") {
        return parsed;
      }
    }

    if (isClaudeCodeAuthError(stderr)) {
      return unauthenticatedAuth(
        getClaudeAuthCommand(AUTH_STATUS_COMMAND),
        stderr,
        "Claude Code requires authentication before it can handle requests."
      );
    }

    return unknownAuth(
      getClaudeAuthCommand(AUTH_STATUS_COMMAND),
      combinedOutput || toErrorMessage(error)
    );
  }
}

async function startClaudeCodeAuth(
  options: ToolInvocationOptions = {}
): Promise<ToolAuthStartResult> {
  const authState = await checkClaudeCodeAuth(options);
  const command = getClaudeAuthCommand(AUTH_START_COMMAND);

  if (authState.authenticated === true) {
    return alreadyAuthenticated(command, authState.output);
  }

  try {
    const { stdout, stderr, exitCode } = await spawnInteractiveCommand(
      "claude",
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
      return failedAuth(
        command,
        "Claude Code auth command exited before starting.",
        output
      );
    }

    if (exitCode !== null && exitCode !== 0) {
      return failedAuth(command, "Claude Code auth command failed to start.", output);
    }

    return startedAuth(command, output, extractAuthInstructions(output));
  } catch (error) {
    return failedAuth(command, toErrorMessage(error));
  }
}

async function checkClaudeCodeUsageLimits() {
  const latestSnapshot = await findLatestClaudeUsageLimits(
    parseClaudeCodeUsageLimitsSnapshot
  );

  return (
    latestSnapshot ??
    unknownUsageLimits(
      "No local Claude Code usage limit snapshot is available yet."
    )
  );
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
    throw createProviderExecutionError(
      TOOL.id,
      "Claude Code did not return any output."
    );
  }

  const parsed = JSON.parse(trimmed) as ClaudeCodeJsonOutput;

  if (parsed.is_error) {
    throw createProviderExecutionError(
      TOOL.id,
      `Claude Code returned an error: ${parsed.result ?? "unknown error"}`
    );
  }

  if (typeof parsed.result !== "string" || parsed.result.length === 0) {
    throw createProviderExecutionError(
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
  async discover() {
    try {
      const { stdout } = await executeCommand("claude", ["--version"], {
        timeoutMs: DISCOVERY_TIMEOUT_MS
      });
      const availableModels = await listAvailableModels();
      const configuredModel = await getConfiguredClaudeCodeModel();

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
        return checkClaudeCodeAuth(options);
      },
      async startAuth(options: ToolInvocationOptions = {}) {
        return startClaudeCodeAuth(options);
      },
      async chat(input: ChatInput, options: ToolInvocationOptions = {}) {
        try {
          const selection = resolveRequestedModel(tool, input.model);
          const { stdout } = await executeCommand(
            "claude",
            buildClaudeCodeArgs({
              prompt: chatInputToPrompt(input),
              model: selection.model
            }),
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

          throw createProviderExecutionError(
            tool.id,
            `Claude Code execution failed: ${toErrorMessage(error)}`,
            stderr
          );
        }
      }
    };

    return connected;
  },
  async checkAuth(_tool, options = {}) {
    return checkClaudeCodeAuth(options);
  },
  async checkUsageLimits() {
    return checkClaudeCodeUsageLimits();
  },
  async startAuth(_tool, options = {}) {
    return startClaudeCodeAuth(options);
  }
};
