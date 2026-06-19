import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { URL } from "node:url";

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require("../../package.json");
import {
  chatWithFallbackRoute,
  discoverTools,
  checkAllToolsHealth,
  checkToolHealth,
  chatWithTool,
  getServerConfig,
  startToolAuth,
  updateServerConfig
} from "./service.js";
import {
  FallbackExhaustedError,
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "../errors/errors.js";
import { validateProviderConfig } from "../config.js";
import type { ChatInput, ProviderConfig, ProviderId } from "../types.js";
import type {
  ChatToolRequest,
  DiscoverResponse,
  AggregateHealthResponse,
  ConfigResponse,
  RoutedChatRequest,
  StartedSwitchboardServer,
  SwitchboardServerOptions
} from "./types.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MAX_TIMEOUT_MS = 60_000;

type JsonError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
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
  message: string,
  details?: Record<string, unknown>
): void {
  writeJson(response, statusCode, {
    error: {
      code,
      message,
      details
    }
  } satisfies JsonError);
}

function getToolId(pathname: string): ProviderId | undefined {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] as ProviderId | undefined;
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

function validateRoutedChatRequest(body: unknown): RoutedChatRequest {
  const input = validateChatRequest(body) as RoutedChatRequest;

  if (!body || typeof body !== "object") {
    throw new TypeError("Request body must be a JSON object.");
  }

  const candidate = body as Record<string, unknown>;

  if (!Array.isArray(candidate.providers) || candidate.providers.length === 0) {
    throw new TypeError("providers must be a non-empty array.");
  }

  const validProviders = candidate.providers.every(
    (provider) =>
      provider === "claude-code" ||
      provider === "codex" ||
      provider === "ollama" ||
      provider === "opencode"
  );

  if (!validProviders) {
    throw new TypeError("providers must contain supported provider ids.");
  }

  if (
    candidate.perAttemptTimeoutMs !== undefined &&
    (typeof candidate.perAttemptTimeoutMs !== "number" ||
      !Number.isFinite(candidate.perAttemptTimeoutMs) ||
      candidate.perAttemptTimeoutMs <= 0)
  ) {
    throw new TypeError(
      "perAttemptTimeoutMs must be a positive number when provided."
    );
  }

  if (
    candidate.retries !== undefined &&
    (typeof candidate.retries !== "number" ||
      !Number.isFinite(candidate.retries) ||
      candidate.retries < 0)
  ) {
    throw new TypeError("retries must be a non-negative number when provided.");
  }

  return {
    ...input,
    providers: candidate.providers,
    timeoutMs:
      typeof candidate.timeoutMs === "number" ? candidate.timeoutMs : undefined,
    perAttemptTimeoutMs:
      typeof candidate.perAttemptTimeoutMs === "number"
        ? candidate.perAttemptTimeoutMs
        : undefined,
    retries: typeof candidate.retries === "number" ? candidate.retries : undefined
  };
}

function validateConfigRequest(body: unknown): ProviderConfig {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TypeError("Request body must be a JSON object.");
  }

  return validateProviderConfig(body as ProviderConfig);
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

  if (error instanceof RateLimitError) {
    writeError(response, 429, "rate_limited", error.message);
    return;
  }

  if (error instanceof QuotaExceededError) {
    writeError(response, 429, "quota_exceeded", error.message);
    return;
  }

  if (error instanceof ToolAuthError) {
    writeError(response, 401, "tool_auth_required", error.message);
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

  if (error instanceof FallbackExhaustedError) {
    writeError(response, 503, "fallback_exhausted", error.message, {
      attempts: error.attempts
    });
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
  const startedAt = Date.now();

  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", `http://${host}`);

    try {
      if (method === "GET" && url.pathname === "/health") {
        const tools = await checkAllToolsHealth({
          timeoutMs: maxTimeoutMs
        });

        writeJson(response, 200, {
          status: "ok",
          version: PACKAGE_VERSION,
          uptimeMs: Date.now() - startedAt,
          tools
        } satisfies AggregateHealthResponse);
        return;
      }

      if (method === "GET" && url.pathname === "/config") {
        writeJson(response, 200, getServerConfig() satisfies ConfigResponse);
        return;
      }

      if (method === "PUT" && url.pathname === "/config") {
        const body = await readJsonBody(request);
        const config = validateConfigRequest(body);

        writeJson(response, 200, updateServerConfig(config) satisfies ConfigResponse);
        return;
      }

      if (method === "POST" && url.pathname.startsWith("/auth/")) {
        const toolId = getToolId(url.pathname);

        if (!toolId) {
          writeError(response, 404, "not_found", "Route not found.");
          return;
        }

        const result = await startToolAuth(toolId, {
          timeoutMs: maxTimeoutMs
        });

        writeJson(response, 200, result);
        return;
      }

      if (method === "GET" && url.pathname === "/discover") {
        const tools = await discoverTools();

        writeJson(response, 200, {
          tools
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
        const result = await checkToolHealth(toolId, { timeoutMs });

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
        const result = await chatWithTool(toolId, input, { timeoutMs });

        writeJson(response, 200, result);
        return;
      }

      if (method === "POST" && url.pathname === "/chat") {
        const body = await readJsonBody(request);
        const input = validateRoutedChatRequest(body);

        if (input.timeoutMs !== undefined) {
          input.timeoutMs = Math.min(input.timeoutMs, maxTimeoutMs);
        }

        if (input.perAttemptTimeoutMs !== undefined) {
          input.perAttemptTimeoutMs = Math.min(
            input.perAttemptTimeoutMs,
            maxTimeoutMs
          );
        }

        const result = await chatWithFallbackRoute(input);

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
