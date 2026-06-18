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
  ConfigResponse,
  DiscoverResponse,
  AggregateHealthResponse,
  HealthResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions,
  ToolAuthResponse,
  ToolHealthResult,
  ToolHealthStatus,
  ToolOperationOptions,
  UpdateConfigRequest
} from "./server/types.js";

export {
  ProviderExecutionError,
  TimeoutError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
