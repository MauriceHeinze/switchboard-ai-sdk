import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { getProviderConfig } from "../config.js";

function normalizeConfiguredString(value?: string): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

export function getConfiguredModel(
  envVarName: string,
  configuredValue?: string
): string | undefined {
  const configuredModel =
    normalizeConfiguredString(configuredValue) ??
    normalizeConfiguredString(process.env[envVarName]);

  return configuredModel ? configuredModel : undefined;
}

export function getConfiguredModelInfo(
  envVarName: string,
  configuredValue?: string
): {
  models?: string[];
  defaultModel?: string;
} {
  const configuredModel = getConfiguredModel(envVarName, configuredValue);

  return {
    models: configuredModel ? [configuredModel] : undefined,
    defaultModel: configuredModel
  };
}

export type ModelSelectionInput = {
  name: string;
  models?: string[];
  defaultModel?: string;
};

export type ModelSelection = {
  model?: string;
  warnings: string[];
};

function getHomeDir(): string {
  return process.env.HOME ?? homedir();
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export async function getConfiguredCodexModel(): Promise<string | undefined> {
  const config = getProviderConfig();
  const envModel = getConfiguredModel(
    "SWITCHBOARD_CODEX_MODEL",
    config?.codexModel
  );

  if (envModel) {
    return envModel;
  }

  const codexHome = process.env.CODEX_HOME?.trim();
  const configPath = codexHome
    ? path.join(codexHome, "config.toml")
    : path.join(getHomeDir(), ".codex", "config.toml");
  const configContents = await readOptionalFile(configPath);

  if (!configContents) {
    return undefined;
  }

  const match = configContents.match(/^\s*model\s*=\s*"([^"]+)"\s*$/m);

  return match?.[1]?.trim() || undefined;
}

export async function getConfiguredClaudeCodeModel(): Promise<string | undefined> {
  const config = getProviderConfig();
  const envModel = getConfiguredModel(
    "SWITCHBOARD_CLAUDE_CODE_MODEL",
    config?.claudeCodeModel
  );

  if (envModel) {
    return envModel;
  }

  const configDir = process.env.CLAUDE_CONFIG_DIR?.trim()
    ? process.env.CLAUDE_CONFIG_DIR!.trim()
    : path.join(getHomeDir(), ".claude");
  const settingsPath = path.join(configDir, "settings.json");
  const rawSettings = await readOptionalFile(settingsPath);

  if (!rawSettings) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawSettings) as { model?: unknown };
    return typeof parsed.model === "string" && parsed.model.trim()
      ? parsed.model.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveRequestedModel(
  tool: ModelSelectionInput,
  requestedModel?: string
): ModelSelection {
  const normalizedModel = requestedModel?.trim();

  if (!normalizedModel) {
    return {
      model: tool.defaultModel,
      warnings: []
    };
  }

  if (Array.isArray(tool.models) && tool.models.length > 0) {
    const availableModels = new Set(tool.models);

    if (!availableModels.has(normalizedModel)) {
      const warnings = [
        `Requested model "${normalizedModel}" is not available for ${tool.name}.`
      ];

      if (tool.defaultModel) {
        warnings.push(
          `Falling back to default model "${tool.defaultModel}".`
        );

        return {
          model: tool.defaultModel,
          warnings
        };
      }

      return {
        model: undefined,
        warnings
      };
    }
  }

  return {
    model: normalizedModel,
    warnings: []
  };
}
