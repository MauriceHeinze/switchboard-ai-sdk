import type { CodexSandboxMode, ProviderConfig } from "./types.js";

let providerConfig: ProviderConfig = {};
const ALLOWED_SANDBOX_MODES = new Set<CodexSandboxMode>([
  "read-only",
  "workspace-write",
  "danger-full-access"
]);

export function validateProviderConfig(config: ProviderConfig = {}): ProviderConfig {
  if (config.ollamaHost !== undefined && typeof config.ollamaHost !== "string") {
    throw new TypeError("ollamaHost must be a string.");
  }

  if (config.ollamaModel !== undefined && typeof config.ollamaModel !== "string") {
    throw new TypeError("ollamaModel must be a string.");
  }

  if (config.codexModel !== undefined && typeof config.codexModel !== "string") {
    throw new TypeError("codexModel must be a string.");
  }

  if (
    config.codexSandbox !== undefined &&
    !ALLOWED_SANDBOX_MODES.has(config.codexSandbox)
  ) {
    throw new TypeError(
      "codexSandbox must be one of read-only, workspace-write, or danger-full-access."
    );
  }

  if (
    config.claudeCodeModel !== undefined &&
    typeof config.claudeCodeModel !== "string"
  ) {
    throw new TypeError("claudeCodeModel must be a string.");
  }

  if (
    config.claudeCodeMaxTurns !== undefined &&
    (!Number.isFinite(config.claudeCodeMaxTurns) || config.claudeCodeMaxTurns <= 0)
  ) {
    throw new TypeError("claudeCodeMaxTurns must be a positive number.");
  }

  if (
    config.opencodeModel !== undefined &&
    typeof config.opencodeModel !== "string"
  ) {
    throw new TypeError("opencodeModel must be a string.");
  }

  const validatedConfig: ProviderConfig = {
    ...config
  };

  if (config.claudeCodeMaxTurns !== undefined) {
    validatedConfig.claudeCodeMaxTurns = Math.trunc(config.claudeCodeMaxTurns);
  }

  return validatedConfig;
}

export function configure(config: ProviderConfig = {}): void {
  providerConfig = validateProviderConfig(config);
}

export function getProviderConfig(): ProviderConfig {
  return { ...providerConfig };
}
