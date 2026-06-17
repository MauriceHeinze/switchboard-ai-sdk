import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { claudeCodeProvider } from "../dist/providers/claude-code.js";
import { codexProvider } from "../dist/providers/codex.js";
import { ollamaProvider } from "../dist/providers/ollama.js";
import { opencodeProvider } from "../dist/providers/opencode.js";

async function withTempPath(commands, run) {
  const originalPath = process.env.PATH;
  const tempDir = await mkdtemp(path.join(tmpdir(), "switchboard-path-"));

  try {
    for (const [command, definition] of Object.entries(commands)) {
      const commandPath = path.join(tempDir, command);
      const script =
        typeof definition === "string"
          ? `#!/bin/sh\nprintf '%s\\n' "${definition}"\n`
          : definition.script;
      await writeFile(commandPath, script);
      await chmod(commandPath, 0o755);
    }

    process.env.PATH = `${tempDir}${path.delimiter}${originalPath ?? ""}`;

    await run();
  } finally {
    process.env.PATH = originalPath;
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function createJsonServer(handler) {
  const server = createServer(async (request, response) => {
    try {
      const body = await handler(request);
      const payload = JSON.stringify(body);
      response.writeHead(200, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload).toString()
      });
      response.end(payload);
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return server;
}

function getServerUrl(server) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected server to expose a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("ollamaProvider discover returns discovered models and configured default", async () => {
  const originalHost = process.env.OLLAMA_HOST;
  const originalDefault = process.env.SWITCHBOARD_OLLAMA_MODEL;
  const server = await createJsonServer((request) => {
    assert.equal(request.url, "/api/tags");

    return {
      models: [{ name: "llama3.2:3b" }, { model: "qwen3:14b" }]
    };
  });

  try {
    process.env.OLLAMA_HOST = getServerUrl(server);
    process.env.SWITCHBOARD_OLLAMA_MODEL = "qwen3:14b";

    await withTempPath({ ollama: "ollama version 0.1.0" }, async () => {
      const tool = await ollamaProvider.discover();

      assert.equal(tool.available, true);
      assert.deepEqual(tool.models, ["llama3.2:3b", "qwen3:14b"]);
      assert.equal(tool.defaultModel, "qwen3:14b");
    });
  } finally {
    process.env.OLLAMA_HOST = originalHost;
    process.env.SWITCHBOARD_OLLAMA_MODEL = originalDefault;
    await closeServer(server);
  }
});

test("ollamaProvider discover returns an empty model list when no models are installed", async () => {
  const originalHost = process.env.OLLAMA_HOST;
  const originalDefault = process.env.SWITCHBOARD_OLLAMA_MODEL;
  const server = await createJsonServer(() => ({ models: [] }));

  try {
    delete process.env.SWITCHBOARD_OLLAMA_MODEL;
    process.env.OLLAMA_HOST = getServerUrl(server);

    await withTempPath({ ollama: "ollama version 0.1.0" }, async () => {
      const tool = await ollamaProvider.discover();

      assert.equal(tool.available, true);
      assert.deepEqual(tool.models, []);
      assert.equal(tool.defaultModel, undefined);
    });
  } finally {
    process.env.OLLAMA_HOST = originalHost;
    process.env.SWITCHBOARD_OLLAMA_MODEL = originalDefault;
    await closeServer(server);
  }
});

test("CLI providers mirror a configured model during discovery", async () => {
  const originalCodexModel = process.env.SWITCHBOARD_CODEX_MODEL;
  const originalClaudeModel = process.env.SWITCHBOARD_CLAUDE_CODE_MODEL;
  const originalOpenCodeModel = process.env.SWITCHBOARD_OPENCODE_MODEL;

  try {
    process.env.SWITCHBOARD_CODEX_MODEL = "gpt-5-codex";
    process.env.SWITCHBOARD_CLAUDE_CODE_MODEL = "claude-fable-5";
    process.env.SWITCHBOARD_OPENCODE_MODEL = "o3-mini";

    await withTempPath(
      {
        codex: "codex 1.2.3",
        claude: "claude 0.9.0",
        opencode: {
          script: `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf '%s\n' 'opencode 0.8.0'
  exit 0
fi

if [ "$1" = "models" ]; then
  printf '%s\n' 'openai/gpt-5.4' 'openai/gpt-5.5'
  exit 0
fi

exit 1
`
        }
      },
      async () => {
        const [codexTool, claudeTool, opencodeTool] = await Promise.all([
          codexProvider.discover(),
          claudeCodeProvider.discover(),
          opencodeProvider.discover()
        ]);

        assert.deepEqual(codexTool.models, ["gpt-5-codex"]);
        assert.equal(codexTool.defaultModel, "gpt-5-codex");
        assert.deepEqual(claudeTool.models, ["claude-fable-5"]);
        assert.equal(claudeTool.defaultModel, "claude-fable-5");
        assert.deepEqual(opencodeTool.models, [
          "o3-mini",
          "openai/gpt-5.4",
          "openai/gpt-5.5"
        ]);
        assert.equal(opencodeTool.defaultModel, "o3-mini");
      }
    );
  } finally {
    process.env.SWITCHBOARD_CODEX_MODEL = originalCodexModel;
    process.env.SWITCHBOARD_CLAUDE_CODE_MODEL = originalClaudeModel;
    process.env.SWITCHBOARD_OPENCODE_MODEL = originalOpenCodeModel;
  }
});

test("CLI providers leave models undefined when no configured model is available", async () => {
  const originalCodexModel = process.env.SWITCHBOARD_CODEX_MODEL;
  const originalClaudeModel = process.env.SWITCHBOARD_CLAUDE_CODE_MODEL;
  const originalOpenCodeModel = process.env.SWITCHBOARD_OPENCODE_MODEL;
  const originalCodexHome = process.env.CODEX_HOME;
  const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const codexHome = await mkdtemp(path.join(tmpdir(), "switchboard-empty-codex-home-"));
  const claudeConfigDir = await mkdtemp(path.join(tmpdir(), "switchboard-empty-claude-config-"));

  try {
    delete process.env.SWITCHBOARD_CODEX_MODEL;
    delete process.env.SWITCHBOARD_CLAUDE_CODE_MODEL;
    delete process.env.SWITCHBOARD_OPENCODE_MODEL;
    process.env.CODEX_HOME = codexHome;
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;

    await withTempPath(
      {
        codex: "codex 1.2.3",
        claude: "claude 0.9.0",
        opencode: {
          script: `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf '%s\n' 'opencode 0.8.0'
  exit 0
fi

if [ "$1" = "models" ]; then
  printf '%s\n' 'openai/gpt-5.4' 'openai/gpt-5.5'
  exit 0
fi

exit 1
`
        }
      },
      async () => {
        const [codexTool, claudeTool, opencodeTool] = await Promise.all([
          codexProvider.discover(),
          claudeCodeProvider.discover(),
          opencodeProvider.discover()
        ]);

        assert.equal(codexTool.models, undefined);
        assert.equal(codexTool.defaultModel, undefined);
        assert.equal(claudeTool.models, undefined);
        assert.equal(claudeTool.defaultModel, undefined);
        assert.deepEqual(opencodeTool.models, ["openai/gpt-5.4", "openai/gpt-5.5"]);
        assert.equal(opencodeTool.defaultModel, undefined);
      }
    );
  } finally {
    process.env.SWITCHBOARD_CODEX_MODEL = originalCodexModel;
    process.env.SWITCHBOARD_CLAUDE_CODE_MODEL = originalClaudeModel;
    process.env.SWITCHBOARD_OPENCODE_MODEL = originalOpenCodeModel;
    process.env.CODEX_HOME = originalCodexHome;
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    await rm(codexHome, { recursive: true, force: true });
    await rm(claudeConfigDir, { recursive: true, force: true });
  }
});

test("codexProvider discovers the default model from CODEX_HOME config", async () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const originalCodexModel = process.env.SWITCHBOARD_CODEX_MODEL;
  const tempDir = await mkdtemp(path.join(tmpdir(), "switchboard-codex-home-"));

  try {
    delete process.env.SWITCHBOARD_CODEX_MODEL;
    process.env.CODEX_HOME = tempDir;
    await writeFile(
      path.join(tempDir, "config.toml"),
      'model = "gpt-5.4"\nservice_tier = "default"\n'
    );

    await withTempPath({ codex: "codex 1.2.3" }, async () => {
      const tool = await codexProvider.discover();

      assert.deepEqual(tool.models, ["gpt-5.4"]);
      assert.equal(tool.defaultModel, "gpt-5.4");
    });
  } finally {
    process.env.CODEX_HOME = originalCodexHome;
    process.env.SWITCHBOARD_CODEX_MODEL = originalCodexModel;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("claudeCodeProvider discovers the default model from settings.json", async () => {
  const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const originalClaudeModel = process.env.SWITCHBOARD_CLAUDE_CODE_MODEL;
  const tempDir = await mkdtemp(path.join(tmpdir(), "switchboard-claude-config-"));

  try {
    delete process.env.SWITCHBOARD_CLAUDE_CODE_MODEL;
    process.env.CLAUDE_CONFIG_DIR = tempDir;
    await writeFile(
      path.join(tempDir, "settings.json"),
      JSON.stringify({ model: "claude-fable-5" })
    );

    await withTempPath({ claude: "claude 0.9.0" }, async () => {
      const tool = await claudeCodeProvider.discover();

      assert.deepEqual(tool.models, ["claude-fable-5"]);
      assert.equal(tool.defaultModel, "claude-fable-5");
    });
  } finally {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    process.env.SWITCHBOARD_CLAUDE_CODE_MODEL = originalClaudeModel;
    await rm(tempDir, { recursive: true, force: true });
  }
});
