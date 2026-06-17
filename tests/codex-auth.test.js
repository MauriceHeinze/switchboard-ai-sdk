import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCodexAuthStatusOutput,
  codexProvider
} from "../dist/providers/codex.js";

test("parseCodexAuthStatusOutput – not logged in returns unauthenticated", () => {
  const result = parseCodexAuthStatusOutput("Not logged in. Run `codex login` to continue.");

  assert.equal(result.authSupported, true);
  assert.equal(result.authenticated, false);
  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(
    result.reason,
    "Codex requires authentication before it can handle requests."
  );
  assert.equal(result.command, "codex login status");
});

test("parseCodexAuthStatusOutput – logged out returns unauthenticated", () => {
  const result = parseCodexAuthStatusOutput("You are logged out");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseCodexAuthStatusOutput – login required returns unauthenticated", () => {
  const result = parseCodexAuthStatusOutput("login required to continue");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseCodexAuthStatusOutput – unauthenticated returns unauthenticated", () => {
  const result = parseCodexAuthStatusOutput("Status: unauthenticated");

  assert.equal(result.authStatus, "unauthenticated");
  assert.equal(result.authenticated, false);
});

test("parseCodexAuthStatusOutput – logged in returns authenticated", () => {
  const result = parseCodexAuthStatusOutput("You are logged in");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
  assert.equal(result.reason, "Codex is authenticated.");
});

test("parseCodexAuthStatusOutput – authenticated returns authenticated", () => {
  const result = parseCodexAuthStatusOutput("Session authenticated");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseCodexAuthStatusOutput – active session returns authenticated", () => {
  const result = parseCodexAuthStatusOutput("Active session detected");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseCodexAuthStatusOutput – ready returns authenticated", () => {
  const result = parseCodexAuthStatusOutput("Codex is ready");

  assert.equal(result.authStatus, "authenticated");
  assert.equal(result.authenticated, true);
});

test("parseCodexAuthStatusOutput – empty string returns unknown", () => {
  const result = parseCodexAuthStatusOutput("");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
  assert.equal(result.command, "codex login status");
});

test("parseCodexAuthStatusOutput – whitespace-only returns unknown", () => {
  const result = parseCodexAuthStatusOutput("   \n  ");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseCodexAuthStatusOutput – unparseable text without heuristics returns unknown", () => {
  const result = parseCodexAuthStatusOutput("some random output 12345");

  assert.equal(result.authStatus, "unknown");
  assert.equal(result.authenticated, null);
});

test("parseCodexAuthStatusOutput – preserves raw output", () => {
  const raw = "logged in with some extra data";
  const result = parseCodexAuthStatusOutput(raw);

  assert.equal(result.output, raw);
});

test("codexProvider.checkAuth delegates to CLI", async () => {
  const tool = await codexProvider.discover();

  if (!tool.available) {
    const result = await codexProvider.checkAuth(tool);
    assert.equal(result.authSupported, true);
    assert.ok(
      result.authStatus === "unknown" || result.authStatus === "unauthenticated"
    );
    return;
  }

  const result = await codexProvider.checkAuth(tool);

  assert.equal(result.authSupported, true);
  assert.ok(["authenticated", "unauthenticated", "unknown"].includes(result.authStatus));
  assert.equal(result.command, "codex login status");
});

test("codexProvider.startAuth returns a valid result shape", async () => {
  const tool = await codexProvider.discover();

  if (!tool.available) {
    return;
  }

  const result = await codexProvider.startAuth(tool);

  assert.ok(
    ["already_authenticated", "started", "failed"].includes(result.status),
    `Unexpected status: ${result.status}`
  );
  assert.equal(result.command, "codex login --device-auth");
  assert.ok(typeof result.authenticated === "boolean" || result.authenticated === null);
});

test("codexProvider.connect exposes checkAuth and startAuth", async () => {
  const tool = await codexProvider.discover();

  if (!tool.available) {
    return;
  }

  const connected = await codexProvider.connect(tool);

  assert.equal(typeof connected.checkAuth, "function");
  assert.equal(typeof connected.startAuth, "function");

  const checkResult = await connected.checkAuth();
  assert.equal(checkResult.authSupported, true);
  assert.ok(
    ["authenticated", "unauthenticated", "unknown"].includes(checkResult.authStatus)
  );
});
