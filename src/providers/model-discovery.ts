export function getConfiguredModel(envVarName: string): string | undefined {
  const configuredModel = process.env[envVarName]?.trim();

  return configuredModel ? configuredModel : undefined;
}

export function getConfiguredModelInfo(envVarName: string): {
  models?: string[];
  defaultModel?: string;
} {
  const configuredModel = getConfiguredModel(envVarName);

  return {
    models: configuredModel ? [configuredModel] : undefined,
    defaultModel: configuredModel
  };
}
