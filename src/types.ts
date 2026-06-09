export type ProviderId = "claude-code" | "codex" | "ollama";

export type ToolType = "agent" | "runtime" | "server" | "unknown";

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
  metadata?: Record<string, unknown>;
};

export type AgentRunInput = {
  prompt: string;
};

export type ChatInput = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

export type ConnectedTool = {
  id: ProviderId;
  name: string;
  type: ToolType;
  capabilities: Capability[];
  health(): Promise<boolean>;
  run?(input: AgentRunInput): Promise<unknown>;
  chat?(input: ChatInput): Promise<unknown>;
};

export type ConnectByCapabilityOptions = {
  capability: Capability;
  prefer?: ProviderId[];
};

export type ConnectInput = ProviderId | ConnectByCapabilityOptions;
