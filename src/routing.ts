import { connect } from "./connect.js";
import { discover } from "./discovery/discover.js";
import {
  FallbackExhaustedError,
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
import { resolveRequestedModel } from "./providers/model-discovery.js";
import type {
  ChatInput,
  DiscoveredTool,
  ProviderId,
  RoutedChatOptions,
  RoutedChatResponse,
  RoutingAttempt,
  RoutingFailureReason,
  ToolInvocationOptions
} from "./types.js";

function normalizeRetries(retries?: number): number {
  if (retries === undefined) {
    return 0;
  }

  if (!Number.isFinite(retries) || retries < 0) {
    return 0;
  }

  return Math.trunc(retries);
}

function createDeadline(timeoutMs?: number): number | undefined {
  return timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
}

function getRemainingMs(deadline?: number): number | undefined {
  if (deadline === undefined) {
    return undefined;
  }

  return deadline - Date.now();
}

function getAttemptTimeoutMs(
  deadline: number | undefined,
  perAttemptTimeoutMs: number | undefined,
  timeoutMs: number | undefined
): number | undefined {
  const configuredTimeout = perAttemptTimeoutMs ?? timeoutMs;
  const remainingMs = getRemainingMs(deadline);

  if (remainingMs !== undefined && remainingMs <= 0) {
    throw new TimeoutError();
  }

  if (configuredTimeout === undefined) {
    return remainingMs;
  }

  if (remainingMs === undefined) {
    return configuredTimeout;
  }

  return Math.min(configuredTimeout, remainingMs);
}

function mapErrorToFailureReason(error: unknown): RoutingFailureReason {
  if (error instanceof ToolUnavailableError || error instanceof ToolNotFoundError) {
    return "unavailable";
  }

  if (error instanceof ToolAuthError) {
    return "unauthenticated";
  }

  if (error instanceof QuotaExceededError) {
    return "quota_exceeded";
  }

  if (error instanceof RateLimitError) {
    return "rate_limited";
  }

  if (error instanceof TimeoutError) {
    return "timeout";
  }

  return "provider_execution_failed";
}

function isRetryableError(error: unknown): boolean {
  return (
    error instanceof TimeoutError ||
    error instanceof QuotaExceededError ||
    error instanceof RateLimitError
  );
}

function isImmediateFallbackError(error: unknown): boolean {
  return error instanceof ToolUnavailableError || error instanceof ToolNotFoundError;
}

function createAttempt(
  input: RoutingAttempt
): RoutingAttempt {
  return input;
}

function getUnavailableReason(tool: DiscoveredTool | undefined, toolId: ProviderId): string {
  if (!tool) {
    return `No provider named "${toolId}" is registered.`;
  }

  return typeof tool.metadata?.reason === "string"
    ? tool.metadata.reason
    : `${tool.name} is not available.`;
}

async function runSingleAttempt(
  tool: DiscoveredTool,
  input: ChatInput,
  options: ToolInvocationOptions = {}
): Promise<RoutedChatResponse["result"] & {
  model?: string;
  warnings?: string[];
  type: RoutedChatResponse["type"];
}> {
  const connected = await connect(tool.id);
  const authState = connected.checkAuth ? await connected.checkAuth(options) : undefined;

  if (authState?.authStatus === "unauthenticated") {
    throw new ToolAuthError(
      tool.id,
      authState.reason ??
        `${tool.name} requires authentication before it can handle requests.`
    );
  }

  const modelSelection = resolveRequestedModel(tool, input.model);
  const result = await connected.chat(
    {
      ...input,
      model: modelSelection.model
    },
    options
  );

  return {
    type: connected.type,
    model: modelSelection.model,
    warnings:
      modelSelection.warnings.length > 0 ? modelSelection.warnings : undefined,
    ...result
  };
}

export function rankProviders(preferred: ProviderId[]): ProviderId[] {
  const seen = new Set<ProviderId>();
  const ranked: ProviderId[] = [];

  for (const provider of preferred) {
    if (!seen.has(provider)) {
      seen.add(provider);
      ranked.push(provider);
    }
  }

  return ranked;
}

export async function chatWithFallback(
  input: ChatInput,
  options: RoutedChatOptions
): Promise<RoutedChatResponse> {
  const providers = rankProviders(options.providers);
  const retries = normalizeRetries(options.retries);
  const attempts: RoutingAttempt[] = [];
  const tools = await discover();
  const deadline = createDeadline(options.timeoutMs);
  let lastError: Error = new ToolUnavailableError(
    providers[0] ?? "unknown",
    "No providers were configured."
  );

  for (const providerId of providers) {
    const tool = tools.find((candidate) => candidate.id === providerId);

    if (!tool || !tool.available) {
      lastError = tool
        ? new ToolUnavailableError(providerId, getUnavailableReason(tool, providerId))
        : new ToolNotFoundError(providerId);
      attempts.push(
        createAttempt({
          toolId: providerId,
          tryIndex: 0,
          stage: "preflight",
          outcome: "skipped",
          reason: "unavailable",
          message: lastError.message
        })
      );
      continue;
    }

    for (let tryIndex = 0; tryIndex <= retries; tryIndex += 1) {
      const startedAt = Date.now();

      try {
        const attemptTimeoutMs = getAttemptTimeoutMs(
          deadline,
          options.perAttemptTimeoutMs,
          options.timeoutMs
        );
        const response = await runSingleAttempt(tool, input, {
          timeoutMs: attemptTimeoutMs
        });

        attempts.push(
          createAttempt({
            toolId: providerId,
            tryIndex,
            stage: "execution",
            outcome: "succeeded",
            latencyMs: Date.now() - startedAt
          })
        );

        return {
          toolId: providerId,
          type: response.type,
          model: response.model,
          warnings: response.warnings,
          result: {
            message: response.message,
            usage: response.usage,
            metadata: response.metadata
          },
          latencyMs: Date.now() - startedAt,
          attempts,
          fallbackUsed: attempts.some((attempt) => attempt.toolId !== providerId)
        };
      } catch (error) {
        const reason = mapErrorToFailureReason(error);
        const outcome = isImmediateFallbackError(error) ? "skipped" : "failed";

        attempts.push(
          createAttempt({
            toolId: providerId,
            tryIndex,
            stage: error instanceof ToolAuthError ? "preflight" : "execution",
            outcome,
            reason,
            message: error instanceof Error ? error.message : String(error),
            latencyMs: Date.now() - startedAt
          })
        );

        lastError =
          error instanceof Error
            ? error
            : new ProviderExecutionError(providerId, String(error));

        if (isImmediateFallbackError(error) || error instanceof ToolAuthError) {
          break;
        }

        if (isRetryableError(error) && tryIndex < retries) {
          continue;
        }

        break;
      }
    }
  }

  throw new FallbackExhaustedError(attempts, lastError);
}
