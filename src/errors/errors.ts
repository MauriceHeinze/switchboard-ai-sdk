export class ToolNotFoundError extends Error {
  constructor(toolId: string) {
    super(`No provider named "${toolId}" is registered.`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolUnavailableError extends Error {
  constructor(toolId: string, message?: string) {
    super(message ?? `The provider "${toolId}" is unavailable.`);
    this.name = "ToolUnavailableError";
  }
}

export class ToolAuthError extends Error {
  constructor(toolId: string, message?: string) {
    super(message ?? `The provider "${toolId}" requires setup or authentication.`);
    this.name = "ToolAuthError";
  }
}

export class ProviderExecutionError extends Error {
  constructor(toolId: string, message?: string) {
    super(message ?? `The provider "${toolId}" failed to execute the request.`);
    this.name = "ProviderExecutionError";
  }
}

export class TimeoutError extends Error {
  constructor(message = "The operation timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}
