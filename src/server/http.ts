import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";
import { discoverTools, checkToolHealth, callTool } from "./service.js";
import {
  ProviderExecutionError,
  TimeoutError,
  ToolNotFoundError,
  ToolUnavailableError
} from "../errors/errors.js";
import type { ChatInput, ProviderId } from "../types.js";
import type {
  CallToolRequest,
  DiscoverResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions
} from "./types.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MAX_TIMEOUT_MS = 60_000;

type JsonError = {
  error: {
    code: string;
    message: string;
  };
};

function createToken(): string {
  return randomBytes(24).toString("hex");
}

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

function getBearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length);
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

function validateCallRequest(body: unknown): CallToolRequest {
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

    return {
      messages: input.messages
    };
  }

  if (typeof input.prompt === "string") {
    return {
      prompt: input.prompt
    };
  }

  throw new TypeError("Request body must include either prompt or messages.");
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
  const token = options.token ?? createToken();
  const maxTimeoutMs = options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS;
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

    const requestToken = getBearerToken(request);

    if (requestToken !== token) {
      writeError(response, 401, "unauthorized", "Missing or invalid bearer token.");
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/discover") {
        const tools = await discoverTools();

        writeJson(response, 200, { tools } satisfies DiscoverResponse);
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

      if (method === "POST" && url.pathname.startsWith("/call/")) {
        const toolId = getToolId(url.pathname);

        if (!toolId) {
          writeError(response, 404, "not_found", "Route not found.");
          return;
        }

        const body = await readJsonBody(request);
        const timeoutMs = getTimeoutMs(body, maxTimeoutMs);
        const input = validateCallRequest(body);
        const result = await callTool(toolId, input, { timeoutMs });

        writeJson(response, 200, result);
        return;
      }

      writeError(response, 404, "not_found", "Route not found.");
    } catch (error) {
      mapError(response, error);
    }
  });

  Reflect.set(server, "switchboardToken", token);

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

  const token = Reflect.get(server, "switchboardToken") as string;

  return {
    host,
    port: address.port,
    token,
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
