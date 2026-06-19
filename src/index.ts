export { connect } from "./connect.js";
export { configure } from "./config.js";
export { discover } from "./discovery/discover.js";
export { executeToolChat } from "./chat.js";
export { chatWithFallback, rankProviders } from "./routing.js";
export {
  chatWithFallbackRoute,
  chatWithTool,
  checkAllToolsHealth,
  checkToolHealth,
  discoverTools,
  startToolAuth
} from "./server/service.js";
export {
  createSwitchboardServer,
  startSwitchboardServer
} from "./server/http.js";

export type {
  Capability,
  ChatInput,
  ChatToolResponse,
  CodexSandboxMode,
  ConnectedTool,
  DiscoveredTool,
  ProviderConfig,
  ProviderId,
  RoutedChatOptions,
  RoutedChatResponse,
  RoutingAttempt,
  RoutingFailureReason,
  ToolMessage,
  ToolResult,
  ToolType
} from "./types.js";
export type {
  ChatToolOptions,
  ChatToolRequest,
  ConfigResponse,
  DiscoverResponse,
  AggregateHealthResponse,
  HealthResponse,
  RoutedChatRequest,
  RoutedChatToolResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions,
  ToolAuthResponse,
  ToolHealthResult,
  ToolHealthStatus,
  ToolOperationOptions,
  UpdateConfigRequest
} from "./server/types.js";

export {
  FallbackExhaustedError,
  ProviderExecutionError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
