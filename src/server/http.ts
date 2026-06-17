import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { discoverTools, checkToolHealth, chatWithTool } from "./service.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolNotFoundError,
  ToolUnavailableError
} from "../errors/errors.js";
import type {
  ChatInput,
  CodexSandboxMode,
  ProviderConfig,
  ProviderId
} from "../types.js";
import type {
  ChatToolRequest,
  DiscoverToolSummary,
  DiscoverResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions
} from "./types.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MAX_TIMEOUT_MS = 60_000;
const ALLOWED_SANDBOX_MODES = new Set<CodexSandboxMode>([
  "read-only",
  "workspace-write",
  "danger-full-access"
]);

type JsonError = {
  error: {
    code: string;
    message: string;
  };
};

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload).toString()
  });
  response.end(payload);
}

function writeError(
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string
): void {
  writeJson(response, statusCode, {
    error: {
      code,
      message
    }
  } satisfies JsonError);
}

function toDiscoverToolSummary(tool: {
  id: string;
  name: string;
  available: boolean;
  models?: string[];
}): DiscoverToolSummary {
  return {
    name: tool.name,
    available: tool.available,
    models: tool.models
  };
}

function getToolId(pathname: string): ProviderId | undefined {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] as ProviderId | undefined;
}

function validateProviderConfig(input: unknown): ProviderConfig {
  if (input === undefined) {
    return {};
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("providerConfig must be an object when provided.");
  }

  const candidate = input as Record<string, unknown>;
  const providerConfig: ProviderConfig = {};

  if (candidate.ollamaHost !== undefined) {
    if (typeof candidate.ollamaHost !== "string") {
      throw new TypeError("providerConfig.ollamaHost must be a string.");
    }

    providerConfig.ollamaHost = candidate.ollamaHost;
  }

  if (candidate.ollamaModel !== undefined) {
    if (typeof candidate.ollamaModel !== "string") {
      throw new TypeError("providerConfig.ollamaModel must be a string.");
    }

    providerConfig.ollamaModel = candidate.ollamaModel;
  }

  if (candidate.codexModel !== undefined) {
    if (typeof candidate.codexModel !== "string") {
      throw new TypeError("providerConfig.codexModel must be a string.");
    }

    providerConfig.codexModel = candidate.codexModel;
  }

  if (candidate.codexSandbox !== undefined) {
    if (
      typeof candidate.codexSandbox !== "string" ||
      !ALLOWED_SANDBOX_MODES.has(candidate.codexSandbox as CodexSandboxMode)
    ) {
      throw new TypeError(
        "providerConfig.codexSandbox must be one of read-only, workspace-write, or danger-full-access."
      );
    }

    providerConfig.codexSandbox = candidate.codexSandbox as CodexSandboxMode;
  }

  if (candidate.claudeCodeModel !== undefined) {
    if (typeof candidate.claudeCodeModel !== "string") {
      throw new TypeError("providerConfig.claudeCodeModel must be a string.");
    }

    providerConfig.claudeCodeModel = candidate.claudeCodeModel;
  }

  if (candidate.claudeCodeMaxTurns !== undefined) {
    if (
      typeof candidate.claudeCodeMaxTurns !== "number" ||
      !Number.isFinite(candidate.claudeCodeMaxTurns) ||
      candidate.claudeCodeMaxTurns <= 0
    ) {
      throw new TypeError(
        "providerConfig.claudeCodeMaxTurns must be a positive number."
      );
    }

    providerConfig.claudeCodeMaxTurns = Math.trunc(
      candidate.claudeCodeMaxTurns
    );
  }

  if (candidate.opencodeModel !== undefined) {
    if (typeof candidate.opencodeModel !== "string") {
      throw new TypeError("providerConfig.opencodeModel must be a string.");
    }

    providerConfig.opencodeModel = candidate.opencodeModel;
  }

  return providerConfig;
}

function mergeProviderConfig(
  base?: ProviderConfig,
  override?: ProviderConfig
): ProviderConfig | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...base,
    ...override
  };
}

function getProviderConfigFromQuery(searchParams: URLSearchParams): ProviderConfig | undefined {
  const rawConfig: Record<string, unknown> = {};

  for (const key of [
    "ollamaHost",
    "ollamaModel",
    "codexModel",
    "codexSandbox",
    "claudeCodeModel",
    "claudeCodeMaxTurns",
    "opencodeModel"
  ]) {
    const value = searchParams.get(key);

    if (value === null) {
      continue;
    }

    rawConfig[key] = key === "claudeCodeMaxTurns" ? Number(value) : value;
  }

  return Object.keys(rawConfig).length > 0
    ? validateProviderConfig(rawConfig)
    : undefined;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(body);
  } catch {
    throw new SyntaxError("Request body must be valid JSON.");
  }
}

function isChatInput(input: Record<string, unknown>): input is ChatInput {
  return Array.isArray(input.messages);
}

function validateChatRequest(body: unknown): ChatToolRequest {
  if (!body || typeof body !== "object") {
    throw new TypeError("Request body must be a JSON object.");
  }

  const input = body as Record<string, unknown>;

  if (isChatInput(input)) {
    const validMessages = input.messages.every((message) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Record<string, unknown>;

      return (
        (candidate.role === "system" ||
          candidate.role === "user" ||
          candidate.role === "assistant") &&
        typeof candidate.content === "string"
      );
    });

    if (!validMessages) {
      throw new TypeError("messages must be an array of { role, content } items.");
    }

    if (input.model !== undefined && typeof input.model !== "string") {
      throw new TypeError("model must be a string when provided.");
    }

    return {
      messages: input.messages,
      model: typeof input.model === "string" ? input.model : undefined
    };
  }

  throw new TypeError("Request body must include messages.");
}

function getProviderConfigFromBody(body: unknown): ProviderConfig | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const providerConfig = (body as Record<string, unknown>).providerConfig;

  return providerConfig === undefined
    ? undefined
    : validateProviderConfig(providerConfig);
}

function getTimeoutMs(
  body: unknown,
  maxTimeoutMs: number
): number | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const timeoutMs = (body as Record<string, unknown>).timeoutMs;

  if (timeoutMs === undefined) {
    return undefined;
  }

  if (
    typeof timeoutMs !== "number" ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new TypeError("timeoutMs must be a positive number when provided.");
  }

  return Math.min(timeoutMs, maxTimeoutMs);
}

function mapError(response: ServerResponse, error: unknown): void {
  if (error instanceof ToolNotFoundError) {
    writeError(response, 404, "tool_not_found", error.message);
    return;
  }

  if (error instanceof ToolUnavailableError) {
    writeError(response, 503, "tool_unavailable", error.message);
    return;
  }

  if (error instanceof TimeoutError) {
    writeError(response, 504, "timeout", error.message);
    return;
  }

  if (error instanceof ProviderExecutionError) {
    writeError(response, 502, "provider_execution_failed", error.message);
    return;
  }

  if (error instanceof SyntaxError || error instanceof TypeError) {
    writeError(response, 400, "invalid_request", error.message);
    return;
  }

  writeError(response, 500, "internal_error", "An unexpected error occurred.");
}

export function createSwitchboardServer(
  options: SwitchboardServerOptions = {}
): Server {
  const host = options.host ?? DEFAULT_HOST;
  const maxTimeoutMs = options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS;
  const defaultProviderConfig = options.providerConfig;
  const startedAt = Date.now();

  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", `http://${host}`);

    if (method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        version: "0.1.0",
        uptimeMs: Date.now() - startedAt
      });
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/discover") {
        const providerConfig = mergeProviderConfig(
          defaultProviderConfig,
          getProviderConfigFromQuery(url.searchParams)
        );
        const tools = await discoverTools({ providerConfig });

        writeJson(response, 200, {
          tools: tools.map(toDiscoverToolSummary)
        } satisfies DiscoverResponse);
        return;
      }

      if (method === "GET" && url.pathname.startsWith("/health/")) {
        const toolId = getToolId(url.pathname);

        if (!toolId) {
          writeError(response, 404, "not_found", "Route not found.");
          return;
        }

        const timeoutMs = getTimeoutMs(
          { timeoutMs: url.searchParams.get("timeoutMs") ? Number(url.searchParams.get("timeoutMs")) : undefined },
          maxTimeoutMs
        );
        const providerConfig = mergeProviderConfig(
          defaultProviderConfig,
          getProviderConfigFromQuery(url.searchParams)
        );
        const result = await checkToolHealth(toolId, { timeoutMs, providerConfig });

        writeJson(response, 200, result);
        return;
      }

      if (method === "POST" && url.pathname.startsWith("/chat/")) {
        const toolId = getToolId(url.pathname);

        if (!toolId) {
          writeError(response, 404, "not_found", "Route not found.");
          return;
        }

        const body = await readJsonBody(request);
        const timeoutMs = getTimeoutMs(body, maxTimeoutMs);
        const input = validateChatRequest(body);
        const providerConfig = mergeProviderConfig(
          defaultProviderConfig,
          getProviderConfigFromBody(body)
        );
        const result = await chatWithTool(toolId, input, {
          timeoutMs,
          providerConfig
        });

        writeJson(response, 200, result);
        return;
      }

      writeError(response, 404, "not_found", "Route not found.");
    } catch (error) {
      mapError(response, error);
    }
  });

  return server;
}

export async function startSwitchboardServer(
  options: SwitchboardServerOptions = {}
): Promise<StartedSwitchboardServer> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? 0;
  const server = createSwitchboardServer(options);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine server address.");
  }

  return {
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}
