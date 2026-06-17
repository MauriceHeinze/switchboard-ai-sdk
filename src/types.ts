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

export type ToolMessage = {
  role: "assistant";
  content: string;
};

export type ToolResult = {
  message: ToolMessage;
  usage?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type ConnectedTool = {
  id: ProviderId;
  name: string;
  type: ToolType;
  capabilities: Capability[];
  models?: string[];
  defaultModel?: string;
  health(options?: ToolInvocationOptions): Promise<boolean>;
  chat(input: ChatInput, options?: ToolInvocationOptions): Promise<ToolResult>;
};

export type ConnectByCapabilityOptions = {
  capability: Capability;
  prefer?: ProviderId[];
};

export type ConnectInput = ProviderId | ConnectByCapabilityOptions;
