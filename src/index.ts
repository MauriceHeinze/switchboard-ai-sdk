export { connect } from "./connect.js";
export { discover } from "./discovery/discover.js";
export {
  callTool,
  checkToolHealth,
  discoverTools
} from "./server/service.js";
export {
  createSwitchboardServer,
  startSwitchboardServer
} from "./server/http.js";

export type {
  AgentRunInput,
  Capability,
  ChatInput,
  ConnectByCapabilityOptions,
  ConnectInput,
  ConnectedTool,
  DiscoveredTool,
  ProviderId,
  ToolType
} from "./types.js";
export type {
  CallToolOptions,
  CallToolRequest,
  CallToolResponse,
  DiscoverResponse,
  HealthResponse,
  StartedSwitchboardServer,
  SwitchboardServerOptions,
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
