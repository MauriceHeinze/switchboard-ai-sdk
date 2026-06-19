import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import type {
  ToolUsageLimitWindow,
  ToolUsageLimits,
  UsageLimitWindowKey
} from "../types.js";

type JsonRecord = Record<string, unknown>;

type JsonlExtractor<T> = (value: unknown) => T | undefined;

function getHomeDir(): string {
  return process.env.HOME ?? homedir();
}

function getCodexSessionsDir(): string {
  const codexHome = process.env.CODEX_HOME?.trim();
  return codexHome
    ? path.join(codexHome, "sessions")
    : path.join(getHomeDir(), ".codex", "sessions");
}

function getClaudeProjectsDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  const baseDir = configDir ? configDir : path.join(getHomeDir(), ".claude");

  return path.join(baseDir, "projects");
}

export function createUsageLimitWindow(
  usedPercentage: number,
  resetsAtEpochSeconds: number
): ToolUsageLimitWindow {
  const boundedUsedPercentage = Math.max(0, Math.min(100, usedPercentage));

  return {
    usedPercentage: boundedUsedPercentage,
    remainingPercentage: Math.max(0, 100 - boundedUsedPercentage),
    resetsAt: new Date(resetsAtEpochSeconds * 1000).toISOString()
  };
}

export function notAvailableUsageLimits(reason: string): ToolUsageLimits {
  return {
    status: "not_available",
    reason
  };
}

export function unknownUsageLimits(reason: string): ToolUsageLimits {
  return {
    status: "unknown",
    reason
  };
}

export function availableUsageLimits(
  windows: Partial<Record<UsageLimitWindowKey, ToolUsageLimitWindow>>,
  options: {
    plan?: string;
    source?: "local_session";
  } = {}
): ToolUsageLimits {
  return {
    status: "available",
    source: options.source ?? "local_session",
    plan: options.plan,
    windows
  };
}

async function collectRecentJsonlFiles(
  rootDir: string,
  limit = 20
): Promise<string[]> {
  const files: Array<{ filePath: string; mtimeMs: number }> = [];

  async function visit(currentDir: string): Promise<void> {
    let entries;

    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await visit(entryPath);
          return;
        }

        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
          return;
        }

        try {
          const details = await stat(entryPath);

          files.push({
            filePath: entryPath,
            mtimeMs: details.mtimeMs
          });
        } catch {
          // Ignore files that disappear during scanning.
        }
      })
    );
  }

  await visit(rootDir);

  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, limit)
    .map((entry) => entry.filePath);
}

async function scanJsonlFileForLatestMatch<T>(
  filePath: string,
  extract: JsonlExtractor<T>
): Promise<T | undefined> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lineReader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let latestMatch: T | undefined;

  try {
    for await (const line of lineReader) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const match = extract(parsed);

        if (match !== undefined) {
          latestMatch = match;
        }
      } catch {
        // Ignore malformed lines in provider state files.
      }
    }
  } finally {
    lineReader.close();
    stream.destroy();
  }

  return latestMatch;
}

export async function findLatestCodexUsageLimits(
  extract: JsonlExtractor<ToolUsageLimits>
): Promise<ToolUsageLimits | undefined> {
  const files = await collectRecentJsonlFiles(getCodexSessionsDir());

  for (const filePath of files) {
    const match = await scanJsonlFileForLatestMatch(filePath, extract);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export async function findLatestClaudeUsageLimits(
  extract: JsonlExtractor<ToolUsageLimits>
): Promise<ToolUsageLimits | undefined> {
  const files = await collectRecentJsonlFiles(getClaudeProjectsDir());

  for (const filePath of files) {
    const match = await scanJsonlFileForLatestMatch(filePath, extract);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function findNestedRecord(
  value: unknown,
  key: string
): JsonRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value[key])) {
    return value[key];
  }

  for (const nestedValue of Object.values(value)) {
    const nestedRecord = findNestedRecord(nestedValue, key);

    if (nestedRecord) {
      return nestedRecord;
    }
  }

  return undefined;
}
