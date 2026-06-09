export type CapabilityRisk = "safe" | "elevated";

export const capabilityRiskLevels = {
  "agent-task": "elevated",
  "code-analysis": "elevated",
  "code-edit": "elevated",
  chat: "safe",
  completion: "safe",
  "model-list": "safe",
  "health-check": "safe",
  embeddings: "safe"
} as const;
