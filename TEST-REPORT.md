# switchboard-ai-sdk Test Report

**Date:** 2026-06-19  
**Tester:** OpenCode  
**Repository:** switchboard-ai-sdk  
**Version tested:** 0.1.8  
**Node.js:** built-in `node --test` runner  

## Executive Summary

The SDK is in a healthy state. All automated tests pass, the TypeScript build is clean, the VitePress docs build succeeds, and live end-to-end validation against locally installed AI tools succeeded for every tool that is present on this machine.

- **117 / 117 unit tests pass**
- **Build, typecheck, and docs build all succeed**
- **Codex, OpenCode, and Ollama work end-to-end** via both the direct SDK and the HTTP server
- **Claude Code is correctly reported as unavailable** because it is not installed on this machine
- A few documentation examples are slightly stale, and one lockfile inconsistency was noticed

---

## 1. Environment Under Test

| Tool | Installed | Version | Notes |
|---|---|---|---|
| Codex | Yes | codex-cli 0.140.0 | Authenticated |
| OpenCode | Yes | 1.17.8 | Authenticated |
| Ollama | Yes | 0.30.8 | Model `qwen3:14b` pulled |
| Claude Code | No | — | Not installed |

---

## 2. Automated Test Suite

Command run:

```bash
npm test
```

Result:

```
ℹ tests 117
ℹ suites 0
ℹ pass 117
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 7587.790042
```

All test files passed:

- `tests/claude-auth.test.js`
- `tests/codex-auth.test.js`
- `tests/http-server.test.js`
- `tests/opencode-auth.test.js`
- `tests/opencode-no-auth.test.js`
- `tests/provider-calls.test.js`
- `tests/provider-discovery.test.js`
- `tests/provider-routing.test.js`
- `tests/runtime-execute.test.js`

---

## 3. Build & Tooling Checks

| Check | Command | Result |
|---|---|---|
| TypeScript build | `npm run build` | OK |
| Type-only check | `npm run typecheck` | OK |
| VitePress docs build | `npm run docs:build` | OK |

---

## 4. Validation Scripts Against Real Local Tools

### 4.1 Provider discovery and health (`npm run validate:providers`)

| Provider | Status | Discovery | Health | Models |
|---|---|---|---|---|
| Codex | Healthy | Yes | Yes | `gpt-5.4` (from `~/.codex/config.toml`) |
| OpenCode | Healthy | Yes | Yes | 23 models discovered |
| Ollama | Healthy | Yes | Yes | `qwen3:14b` |
| Claude Code | Unavailable | No | N/A | None |

### 4.2 Full server validation (`npm run validate`)

All checks passed (`validate: OK`). Notable results:

- `GET /health` returned 200 with correct tool statuses and usage-limit windows for Codex.
- `GET /discover` returned all four providers with correct metadata.
- Per-provider `GET /health/:toolId` returned 200 for installed tools and 404 for `/health/not-a-tool`.
- `POST /chat/codex` returned a real assistant response with usage metadata.
- `POST /chat/opencode` returned a real assistant response.
- `POST /chat/ollama` returned a real assistant response with Ollama-style usage and metadata.
- Model fallback worked: requesting a non-existent model fell back to the provider default and emitted warnings.
- Invalid request bodies were rejected with `400 invalid_request`.

### 4.3 Usage-limit validation (`npm run validate:usage`)

| Tool | Usage Limits | Notes |
|---|---|---|
| Codex | Available | `five_hour` and `seven_day` windows parsed from local session JSONL |
| Claude Code | Unknown | No local snapshot available |
| Ollama | Not available | Expected |
| OpenCode | Not available | Expected |

---

## 5. Manual SDK & HTTP API Tests

A set of ad-hoc scripts exercised the public API surface directly.

### 5.1 Direct SDK API

| Feature | Test | Result |
|---|---|---|
| `configure()` | Set `ollamaModel` and `codexSandbox` | Works |
| `configure()` validation | Reject `claudeCodeMaxTurns: 0` | Works, throws `TypeError` |
| `discover()` | Returns all four providers with availability | Works |
| `connect(toolId)` + `tool.health()` | Codex, OpenCode, Ollama | Works |
| `connect(toolId)` + `tool.chat()` | Codex, OpenCode, Ollama | Works |
| `chat()` routing | Fallback across Codex → OpenCode → Ollama | Works |
| `checkAllToolsHealth()` | Returns status for all providers | Works |
| Error handling | `connect("claude-code")` throws `ToolUnavailableError` | Works |
| Auth flows | `checkAuth()` and `startAuth()` on Codex/OpenCode | Works, reports authenticated |

### 5.2 HTTP Server API

| Endpoint | Test | Result |
|---|---|---|
| `GET /config` | Returns current config | Works |
| `PUT /config` | Updates process config | Works |
| `GET /health` | Aggregate health | Works |
| `GET /discover` | Tool discovery | Works |
| `GET /health/:toolId` | Per-tool health | Works |
| `GET /health/unknown-tool` | Unknown provider | Returns `404 tool_not_found` |
| `POST /auth/ollama` | Non-auth provider | Returns `200 unsupported` |
| `POST /chat/:toolId` | Chat via HTTP | Works |
| `POST /chat` | Routed chat via HTTP | Works |
| Invalid body | Missing `messages` | Returns `400 invalid_request` |
| Invalid providers | `providers: ["unknown"]` | Returns `400 invalid_request` |

---

## 6. Features Working as Expected

- Provider discovery for Codex, Claude Code, OpenCode, and Ollama.
- Model discovery and configured/default model resolution.
- Direct SDK chat for all installed providers.
- Retry-aware, fallback-aware routing via `chat()`.
- Health checks, auth checks, and auth-start flows.
- Codex and Claude Code usage-limit parsing from local session files.
- Local HTTP server mirroring the SDK surface.
- Config validation and process-level config updates.
- Typed error classes and HTTP error-code mapping.
- Timeout and abort-signal handling.

---

## 7. Issues / Observations

### 7.1 Environment-specific (not SDK bugs)

- **Claude Code is unavailable** on this machine because the `claude` CLI is not installed. The SDK correctly reports this as `unavailable` with reason `CLI not found or not ready.`

### 7.2 Documentation / examples slightly stale

- `docs/API-REFERENCE.md` example for `GET /health` showed `"version": "0.1.0"`; the actual package version is `0.1.8`.
- Some example capability lists in README/docs omitted newer capabilities such as `code-analysis`, `code-edit`, and `chat` that are now exposed by the agent providers.
- **Fixed:** Updated version examples to `0.1.8` and capability arrays to match the current provider definitions in `README.md`, `docs/API-REFERENCE.md`, and `docs/guide/http-server.md`.

### 7.3 Lockfile inconsistency

- `package.json` declared version `0.1.8`, but the committed `package-lock.json` still declared `0.1.7`. Running `npm install` updated the lockfile to `0.1.8`.
- **Fixed:** `package-lock.json` now matches `package.json` at `0.1.8`.

### 7.4 Dependency vulnerabilities

- `npm install` reported `3 vulnerabilities (2 moderate, 1 high)`. These are in the development-dependency tree (`vitepress` / `vite` / `esbuild`) and do not affect the runtime SDK.
- **Status:** `npm audit fix` could not resolve them because no patched versions are available for the current `vitepress` dependency tree. They require upstream fixes or a manual vitepress upgrade.

---

## 8. Conclusion

The `switchboard-ai-sdk` is **functionally complete and working as documented** for the providers available in this environment. The test suite provides good coverage, the public API behaves consistently between direct SDK usage and the HTTP bridge, and real provider calls succeed. The only findings are minor documentation/lockfile housekeeping items and environment-specific absence of Claude Code.

**Recommendation:** Address the `package-lock.json` version mismatch and run `npm audit fix` or review the reported vulnerabilities. Consider refreshing the README/API-REFERENCE examples to match the current capability lists and package version.
