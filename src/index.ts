export { connect } from "./connect.js";
export { discover } from "./discovery/discover.js";

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

export {
  CapabilityNotSupportedError,
  ProviderExecutionError,
  ToolAuthError,
  ToolNotFoundError,
  ToolUnavailableError
} from "./errors/errors.js";
