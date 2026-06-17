export { connect } from "./connect.js";
export { configure } from "./config.js";
export { discover } from "./discovery/discover.js";
export {
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
  CodexSandboxMode,
  ConnectByCapabilityOptions,
  ConnectInput,
  ConnectedTool,
  DiscoveredTool,
  ProviderConfig,
  ProviderId,
  ToolMessage,
  ToolResult,
  ToolType
} from "./types.js";
export type {
  ChatToolOptions,
  ChatToolRequest,
  ChatToolResponse,
  DiscoverResponse,
  AggregateHealthResponse,
  HealthResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions,
  ToolAuthResponse,
  ToolHealthResult,
  ToolHealthStatus,
  ToolOperationOptions
} from "./server/types.js";

export {
  CapabilityNotSupportedError,
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
