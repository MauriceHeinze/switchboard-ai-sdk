import { executeCommand } from "../runtime/execute.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
  ToolUnavailableError
} from "../errors/errors.js";
import type { ProviderDefinition } from "../discovery/types.js";
import type {
  AgentRunInput,
  ConnectedTool,
  DiscoveredTool,
  ToolInvocationOptions
} from "../types.js";
import { getConfiguredModel, getConfiguredModelInfo } from "./model-discovery.js";

const TOOL: Omit<DiscoveredTool, "available" | "version" | "metadata"> = {
  id: "opencode",
  name: "OpenCode",
  type: "agent",
  capabilities: ["agent-task", "code-analysis", "code-edit", "health-check"]
};
const DISCOVERY_TIMEOUT_MS = 5_000;

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
  return getConfiguredModel("SWITCHBOARD_OPENCODE_MODEL");
}

async function listAvailableModels(): Promise<string[] | undefined> {
  return getConfiguredModelInfo("SWITCHBOARD_OPENCODE_MODEL").models;
}

function buildOpenCodeArgs(input: AgentRunInput): string[] {
  const args = ["run", "--format", "json"];

  const configuredModel = getConfiguredOpenCodeModel();

  if (configuredModel) {
    args.push("--model", configuredModel);
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
      async run(input, options: ToolInvocationOptions = {}) {
        try {
          const { stdout } = await executeCommand(
            "opencode",
            buildOpenCodeArgs(input),
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
  }
};
