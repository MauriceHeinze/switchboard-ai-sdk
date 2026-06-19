---
title: FAQ — switchboard-ai-sdk
description: Frequently asked questions about switchboard-ai-sdk. Browser support, API costs, runtime, providers, and alternatives.
og:title: switchboard-ai-sdk FAQ
og:description: Answers to common questions about using switchboard-ai-sdk in Node.js and Electron apps.
---

# FAQ

## Can I use switchboard-ai-sdk in the browser?

No, not directly. switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.

For browser-facing code, use the optional local HTTP bridge from an Electron main process or a Node.js backend. The browser then talks to localhost, not to the provider directly.

## Does switchboard-ai-sdk remove API costs?

It removes hosted API costs for the app developer when users run their own local tools or authenticated CLIs. Users may still need accounts or local models depending on the provider.

For example:

- Ollama running locally has no per-request cost
- OpenCode free models do not require a paid subscription
- Codex, Claude Code, and OpenCode Go may require a paid provider account

## Is switchboard-ai-sdk an SDK?

Yes. It exposes a TypeScript API for discovery, connection, chat, health checks, auth checks, configuration, and an optional HTTP server.

## Is switchboard-ai-sdk a LangChain alternative?

Not directly. LangChain is an orchestration framework for building chains, agents, and RAG pipelines. switchboard-ai-sdk is lower-level and focused on accessing local AI tools through one interface.

You can use switchboard-ai-sdk as a provider bridge inside a LangChain tool or agent.

## Which runtimes are supported?

Node.js 18+ and Electron with Node.js integration.

## Which providers are supported?

- Codex
- Claude Code
- OpenCode
- Ollama

## Do I need to install the providers myself?

Yes. switchboard-ai-sdk discovers and connects to tools that are already installed on the user's machine. It does not install them for you.

## Can I use switchboard-ai-sdk without the HTTP server?

Yes. The direct SDK API is the default and recommended path for Node.js and Electron apps. Use `startSwitchboardServer()` only when the caller is not a Node.js process.

## What is the difference between agent and runtime tools?

- **Agent tools** (Codex, Claude Code, OpenCode) can autonomously execute tasks and may modify files
- **Runtime tools** (Ollama) serve models passively and do not modify the environment

## Where can I get help?

- [GitHub issues](https://github.com/MauriceHeinze/switchboard-ai-sdk/issues)
- [API reference](/api/reference)
- [Troubleshooting](/troubleshooting)
