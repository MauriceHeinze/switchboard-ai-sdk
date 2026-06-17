import type {
  ToolAuthCheckResult,
  ToolAuthStartResult
} from "../types.js";

export function notSupportedAuth(command = ""): ToolAuthCheckResult {
  return {
    authSupported: false,
    authenticated: null,
    authStatus: "not_supported",
    reason: "This provider does not require a separate authentication flow.",
    command
  };
}

export function unknownAuth(
  command: string,
  output?: string,
  reason = "Unable to determine authentication state."
): ToolAuthCheckResult {
  return {
    authSupported: true,
    authenticated: null,
    authStatus: "unknown",
    reason,
    command,
    output
  };
}

export function authenticatedAuth(
  command: string,
  output?: string,
  reason = "Provider is authenticated."
): ToolAuthCheckResult {
  return {
    authSupported: true,
    authenticated: true,
    authStatus: "authenticated",
    reason,
    command,
    output
  };
}

export function unauthenticatedAuth(
  command: string,
  output?: string,
  reason = "Provider requires authentication."
): ToolAuthCheckResult {
  return {
    authSupported: true,
    authenticated: false,
    authStatus: "unauthenticated",
    reason,
    command,
    output
  };
}

export function startedAuth(
  command: string,
  output?: string,
  instructions?: string
): ToolAuthStartResult {
  return {
    status: "started",
    authenticated: false,
    command,
    message: "Authentication flow started.",
    instructions,
    output
  };
}

export function alreadyAuthenticated(
  command: string,
  output?: string
): ToolAuthStartResult {
  return {
    status: "already_authenticated",
    authenticated: true,
    command,
    message: "Provider is already authenticated.",
    output
  };
}

export function failedAuth(
  command: string,
  message: string,
  output?: string
): ToolAuthStartResult {
  return {
    status: "failed",
    authenticated: false,
    command,
    message,
    output
  };
}

export function unsupportedAuth(command = ""): ToolAuthStartResult {
  return {
    status: "unsupported",
    authenticated: null,
    command,
    message: "This provider does not support a separate authentication flow."
  };
}

export function extractAuthInstructions(output: string): string | undefined {
  const trimmed = output.trim();

  if (!trimmed) {
    return undefined;
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const preferredLine = lines.find((line) =>
    /(visit|open|browser|code|device|login|sign in|authenticate|https?:\/\/)/i.test(
      line
    )
  );

  return preferredLine ?? lines[0];
}
