import test from "node:test";
import assert from "node:assert/strict";
import {
  parseClaudeCodeAuthStatusOutput,
  claudeCodeProvider
} from "../dist/providers/claude-code.js";

test("parseClaudeCodeAuthStatusOutput – authenticated: true", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ authenticated: true })
  );

  assert.equal(result.authSupported, true);
  assert.equal(result.authenticated, true);
  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.reason, "Claude Code is authenticated.");
  assert.equal(result.command, "claude auth status --json");
});

test("parseClaudeCodeAuthStatusOutput – loggedIn: true", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ loggedIn: true })
  );

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseClaudeCodeAuthStatusOutput – isAuthenticated: true", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ isAuthenticated: true })
  );

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseClaudeCodeAuthStatusOutput – valid: true", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ valid: true })
  );

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseClaudeCodeAuthStatusOutput – authenticated: false", () => {
  const result = parseClaudeCodeAuthStatusOutput(
    JSON.stringify({ authenticated: false })
  );

  assert.equal(result.authSupported, true);
  assert.equal(result.authenticated, false);
  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(
    result.reason,
    "Claude Code requires authentication before it can handle requests."
  );
  assert.equal(result.command, "claude auth status --json");
});

test("parseClaudeCodeAuthStatusOutput – loggedIn: false with metadata", () => {
  const output = JSON.stringify({
    loggedIn: false,
    authMethod: "none",
    apiProvider: "firstParty"
  });
  const result = parseClaudeCodeAuthStatusOutput(output);

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
  assert.equal(result.output, output);
});

test("parseClaudeCodeAuthStatusOutput – empty string returns unknown", () => {
  const result = parseClaudeCodeAuthStatusOutput("");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
  assert.equal(result.command, "claude auth status --json");
});

test("parseClaudeCodeAuthStatusOutput – whitespace-only returns unknown", () => {
  const result = parseClaudeCodeAuthStatusOutput("   \n  ");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseClaudeCodeAuthStatusOutput – text heuristic: not logged in", () => {
  const result = parseClaudeCodeAuthStatusOutput("Error: not logged in");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseClaudeCodeAuthStatusOutput – text heuristic: unauthorized", () => {
  const result = parseClaudeCodeAuthStatusOutput("unauthorized access");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseClaudeCodeAuthStatusOutput – text heuristic: login required", () => {
  const result = parseClaudeCodeAuthStatusOutput("login required to continue");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseClaudeCodeAuthStatusOutput – text heuristic: logged in", () => {
  const result = parseClaudeCodeAuthStatusOutput("You are logged in");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseClaudeCodeAuthStatusOutput – text heuristic: authenticated", () => {
  const result = parseClaudeCodeAuthStatusOutput("Session authenticated");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseClaudeCodeAuthStatusOutput – unparseable text without heuristics returns unknown", () => {
  const result = parseClaudeCodeAuthStatusOutput("some random output 12345");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseClaudeCodeAuthStatusOutput – preserves raw output", () => {
  const raw = JSON.stringify({ authenticated: true, extra: "data" });
  const result = parseClaudeCodeAuthStatusOutput(raw);

  assert.equal(result.output, raw);
});

test("claudeCodeProvider.checkAuth delegates to CLI", async () => {
  const tool = await claudeCodeProvider.discover();

  if (!tool.available) {
    const result = await claudeCodeProvider.checkAuth(tool);
    assert.equal(result.authSupported, true);
    assert.ok(
      result.authStatus === "unknown" || result.authStatus === "unauthenticated"
    );
    return;
  }

  const result = await claudeCodeProvider.checkAuth(tool);

  assert.equal(result.authSupported, true);
  assert.ok(["authenticated", "unauthenticated", "unknown"].includes(result.authStatus));
  assert.equal(result.command, "claude auth status --json");
});

test("claudeCodeProvider.startAuth returns a valid result shape", async () => {
  const tool = await claudeCodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const result = await claudeCodeProvider.startAuth(tool);

  assert.ok(
    ["already_authenticated", "started", "failed"].includes(result.status),
    `Unexpected status: ${result.status}`
  );
  assert.equal(result.command, "claude auth login --claudeai");
  assert.ok(typeof result.authenticated === "boolean" || result.authenticated === null);
});

test("claudeCodeProvider.connect exposes checkAuth and startAuth", async () => {
  const tool = await claudeCodeProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await claudeCodeProvider.connect(tool);

  assert.equal(typeof connected.checkAuth, "function");
  assert.equal(typeof connected.startAuth, "function");

  const checkResult = await connected.checkAuth();
  assert.equal(checkResult.authSupported, true);
  assert.ok(
    ["authenticated", "unauthenticated", "unknown"].includes(checkResult.authStatus)
  );
});
