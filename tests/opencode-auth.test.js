import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOpenCodeExecutionFailure,
  parseOpenCodeAuthStatusOutput,
  opencodeProvider
} from "../dist/providers/opencode.js";

test("parseOpenCodeAuthStatusOutput – 0 credentials returns unauthenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("0 credentials");

  assert.equal(result.authSupported, true);
  assert.equal(result.authenticated, false);
  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(
    result.reason,
    "OpenCode requires authentication before it can handle requests."
  );
  assert.equal(result.command, "opencode auth list");
});

test("parseOpenCodeAuthStatusOutput – empty credentials list returns unauthenticated", () => {
  const output = "┌  Credentials ~/.local/share/opencode/auth.json\n└  0 credentials\n";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseOpenCodeAuthStatusOutput – not logged in returns unauthenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("Error: not logged in");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseOpenCodeAuthStatusOutput – unauthorized returns unauthenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("unauthorized access");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseOpenCodeAuthStatusOutput – login required returns unauthenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("login required to continue");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseOpenCodeAuthStatusOutput – no credentials returns unauthenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("no credentials found");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseOpenCodeAuthStatusOutput – logged in returns authenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("You are logged in");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
  assert.equal(result.reason, "OpenCode is authenticated.");
});

test("parseOpenCodeAuthStatusOutput – authenticated returns authenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("Session authenticated");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – connected returns authenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("Provider connected");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – default provider configured returns authenticated", () => {
  const output = "default provider configured and connected";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – 1 credentials returns authenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("1 credentials");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – multiple credentials returns authenticated", () => {
  const result = parseOpenCodeAuthStatusOutput("5 credentials");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – credential list with 1 entry returns authenticated", () => {
  const output = "\u001b[0m\n┌  Credentials ~/.local/share/opencode/auth.json\n│\n●  OpenAI oauth\n│\n└  1 credentials\n";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – strips ANSI codes", () => {
  const output = "\u001b[32mlogged in\u001b[0m";
  const result = parseOpenCodeAuthStatusOutput(output);

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseOpenCodeAuthStatusOutput – empty string returns unknown", () => {
  const result = parseOpenCodeAuthStatusOutput("");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
  assert.equal(result.command, "opencode auth list");
});

test("parseOpenCodeAuthStatusOutput – whitespace-only returns unknown", () => {
  const result = parseOpenCodeAuthStatusOutput("   \n  ");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseOpenCodeAuthStatusOutput – unparseable text without heuristics returns unknown", () => {
  const result = parseOpenCodeAuthStatusOutput("some random output 12345");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseOpenCodeAuthStatusOutput – preserves raw output", () => {
  const raw = "logged in with some extra data";
  const result = parseOpenCodeAuthStatusOutput(raw);

  assert.equal(result.output, raw);
});

test("parseOpenCodeExecutionFailure – token invalidated JSON returns auth error", () => {
  const output = JSON.stringify({
    type: "error",
    error: {
      name: "APIError",
      data: {
        message:
          "Your authentication token has been invalidated. Please try signing in again.",
        statusCode: 401
      }
    }
  });

  const result = parseOpenCodeExecutionFailure(output);

  assert.equal(result.authError, true);
  assert.match(
    result.message ?? "",
    /authentication token has been invalidated/i
  );
});

test("parseOpenCodeExecutionFailure – non-auth JSON error stays non-auth", () => {
  const output = JSON.stringify({
    type: "error",
    error: {
      name: "APIError",
      data: {
        message: "Rate limit exceeded",
        statusCode: 429
      }
    }
  });

  const result = parseOpenCodeExecutionFailure(output);

  assert.equal(result.authError, false);
});

test("opencodeProvider.checkAuth delegates to CLI", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    const result = await opencodeProvider.checkAuth(tool);
    assert.equal(result.authSupported, true);
    assert.ok(
      result.authStatus === "unknown" || result.authStatus === "unauthenticated"
    );
    return;
  }

  const result = await opencodeProvider.checkAuth(tool);

  assert.equal(result.authSupported, true);
  assert.ok(["authenticated", "unauthenticated", "unknown"].includes(result.authStatus));
  assert.equal(result.command, "opencode auth list");
});

test("opencodeProvider.startAuth returns a valid result shape", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const result = await opencodeProvider.startAuth(tool);

  assert.ok(
    ["already_authenticated", "started", "failed"].includes(result.status),
    `Unexpected status: ${result.status}`
  );
  assert.equal(result.command, "opencode auth login");
  assert.ok(typeof result.authenticated === "boolean" || result.authenticated === null);
});

test("opencodeProvider.connect exposes checkAuth and startAuth", async () => {
  const tool = await opencodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await opencodeProvider.connect(tool);

  assert.equal(typeof connected.checkAuth, "function");
  assert.equal(typeof connected.startAuth, "function");

  const checkResult = await connected.checkAuth();
  assert.equal(checkResult.authSupported, true);
  assert.ok(
    ["authenticated", "unauthenticated", "unknown"].includes(checkResult.authStatus)
  );
});
