import type { ProviderId } from "../types.js";
import type { ProviderDefinition } from "../discovery/types.js";
import { claudeCodeProvider } from "./claude-code.js";
import { codexProvider } from "./codex.js";
import { ollamaProvider } from "./ollama.js";

export const providerRegistry: Record<ProviderId, ProviderDefinition> = {
  "claude-code": claudeCodeProvider,
  codex: codexProvider,
  ollama: ollamaProvider
};
