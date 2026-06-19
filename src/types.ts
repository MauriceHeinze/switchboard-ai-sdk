export type ProviderId = "claude-code" | "codex" | "ollama" | "opencode";

export type ToolType = "agent" | "runtime" | "server" | "unknown";

export type CodexSandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export type ProviderConfig = {
  ollamaHost?: string;
  ollamaModel?: string;
  codexModel?: string;
  codexSandbox?: CodexSandboxMode;
  claudeCodeModel?: string;
  claudeCodeMaxTurns?: number;
  opencodeModel?: string;
};

export type Capability =
  | "agent-task"
  | "code-analysis"
  | "code-edit"
  | "chat"
  | "completion"
  | "model-list"
  | "health-check"
  | "embeddings";

export type DiscoveredTool = {
  id: ProviderId;
  name: string;
  type: ToolType;
  available: boolean;
  version?: string;
  capabilities: Capability[];
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
};

export type ChatInput = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
};

export type ToolInvocationOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type AuthStatus =
  | "authenticated"
  | "unauthenticated"
  | "not_supported"
  | "unknown";

export type ToolAuthCheckResult = {
  authSupported: boolean;
  authenticated: boolean | null;
  authStatus: AuthStatus;
  reason?: string;
  command?: string;
  output?: string;
};

export type ToolAuthStartStatus =
  | "already_authenticated"
  | "started"
  | "unsupported"
  | "failed";

export type ToolAuthStartResult = {
  status: ToolAuthStartStatus;
  authenticated: boolean | null;
  command: string;
  message?: string;
  instructions?: string;
  output?: string;
};

export type ToolMessage = {
  role: "assistant";
  content: string;
};

export type ToolResult = {
  message: ToolMessage;
  usage?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type ChatToolResponse = {
  toolId: ProviderId;
  type: ToolType;
  model?: string;
  warnings?: string[];
  result: ToolResult;
  latencyMs: number;
};

export type RoutingFailureReason =
  | "unavailable"
  | "unauthenticated"
  | "quota_exceeded"
  | "rate_limited"
  | "timeout"
  | "provider_execution_failed";

export type AttemptStage = "preflight" | "execution";

export type RoutingAttempt = {
  toolId: ProviderId;
  tryIndex: number;
  stage: AttemptStage;
  outcome: "skipped" | "failed" | "succeeded";
  reason?: RoutingFailureReason;
  message?: string;
  latencyMs?: number;
};

export type RoutedChatOptions = {
  providers: ProviderId[];
  timeoutMs?: number;
  perAttemptTimeoutMs?: number;
  retries?: number;
};

export type RoutedChatResponse = ChatToolResponse & {
  attempts: RoutingAttempt[];
  fallbackUsed: boolean;
};

export type ConnectedTool = {
  id: ProviderId;
  name: string;
  type: ToolType;
  capabilities: Capability[];
  models?: string[];
  defaultModel?: string;
  health(options?: ToolInvocationOptions): Promise<boolean>;
  checkAuth?(options?: ToolInvocationOptions): Promise<ToolAuthCheckResult>;
  startAuth?(options?: ToolInvocationOptions): Promise<ToolAuthStartResult>;
  chat(input: ChatInput, options?: ToolInvocationOptions): Promise<ToolResult>;
};
