import {
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError
} from "../errors/errors.js";
import type { ProviderId } from "../types.js";

type ProviderFailureKind =
  | "quota_exceeded"
  | "rate_limited"
  | "provider_execution_failed";

function normalizeOutput(output: string): string {
  return output.trim().toLowerCase();
}

export function detectProviderFailureKind(
  output: string
): ProviderFailureKind {
  const normalized = normalizeOutput(output);

  if (!normalized) {
    return "provider_execution_failed";
  }

  if (
    /(insufficient quota|quota exceeded|quota has been exceeded|out of quota|exceeded your current quota|usage limit reached|credit balance is too low)/i.test(
      normalized
    )
  ) {
    return "quota_exceeded";
  }

  if (
    /(rate limit|rate-limited|too many requests|429|try again later|requests per minute|capacity.*reached|temporarily overloaded)/i.test(
      normalized
    )
  ) {
    return "rate_limited";
  }

  return "provider_execution_failed";
}

export function createProviderExecutionError(
  toolId: ProviderId,
  message: string,
  output = ""
): ProviderExecutionError {
  const kind = detectProviderFailureKind([message, output].filter(Boolean).join("\n"));

  if (kind === "quota_exceeded") {
    return new QuotaExceededError(toolId, message);
  }

  if (kind === "rate_limited") {
    return new RateLimitError(toolId, message);
  }

  return new ProviderExecutionError(toolId, message);
}
