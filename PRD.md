# PRD: switchboard-ai

## 1. Product Summary

switchboard-ai is an open-source npm package that lets app developers connect their applications to local AI tools like Claude Code, Codex, Ollama, LM Studio, and other locally available AI interfaces.

The goal is to make it easy for developers to power their apps with AI without manually integrating every local AI tool, writing provider-specific glue code, or relying only on paid cloud APIs.

## 2. One-Liner

Connect your app to local AI tools.

## 3. Product Description

switchboard-ai helps app developers discover and use locally available AI tools, agents, and runtimes through one unified API.

It starts with Electron support, but the long-term direction is to support any app environment where local AI tools can be discovered and used.

## 4. Target Users

Primary target users:

- App developers
- Electron developers
- Indie hackers building AI-powered desktop apps
- Developers building local-first tools
- Developers who want AI features without cloud API billing
- Developers who want to reuse existing local tools like Claude Code, Codex, or Ollama

Secondary target users:

- Tauri developers
- VS Code extension developers
- CLI tool developers
- Local automation tool builders
- Open-source AI app builders

## 5. Problem

Developers want to add AI features to their apps, but the current setup is fragmented.

Each local AI tool has its own interface, setup process, API style, and capabilities.

Examples:

- Claude Code and Codex behave more like local coding agents
- Ollama behaves more like a local model runtime
- LM Studio behaves like a local model server / desktop runtime
- Other tools may expose localhost APIs, CLIs, sockets, or custom protocols

This creates unnecessary friction:

- Developers need custom integrations for every tool
- Apps need to know which tools are installed or running
- Different AI tools expose different capabilities
- There is no common discovery layer
- There is no simple way to say: “use whatever local AI tool is available”
- Developers may depend on cloud APIs even when users already have powerful local AI tools installed

## 6. Product Goal

Make local AI tools usable from apps through one simple package.

switchboard-ai should allow a developer to:

- Discover available local AI tools
- Understand what each tool can do
- Connect to supported tools
- Send requests through a unified API
- Route tasks to the best available local interface
- Build AI features with less setup and less provider-specific code

## 7. Non-Goals

Initial versions should not try to:

- Build a full AI chat app
- Replace Claude Code, Codex, Ollama, or LM Studio
- Train or host models
- Provide a cloud AI service
- Become a full agent framework
- Solve every provider API difference perfectly
- Support every desktop framework on day one

## 8. Positioning

### Main positioning

switchboard-ai lets app developers connect to local AI tools like Claude Code and Codex to power their apps with AI.

### Alternative positioning

- One interface for local AI tools.
- Discover and use local AI tools from your app.
- Route your app to local AI tools, agents, and runtimes.
- Add AI features without provider-specific glue code.
- Use the AI tools your users already have installed.

## 9. Brand Direction

Name: switchboard-ai

Brand feel:

- Raycast-like
- Developer-first
- Productized, but open-source
- Local-first
- Clean and modern
- Practical, not overly academic
- Slightly infrastructural, but not boring

Brand metaphor:

A switchboard connects many different local AI tools to one application interface.

## 10. Key Concepts

### AI Tool

A locally available tool that can provide AI-powered functionality.

Examples:

- Claude Code
- Codex
- Ollama
- LM Studio
- llama.cpp server
- OpenAI-compatible localhost server

### Agent

A local AI interface that can perform actions, not only return text.

Examples:

- Claude Code
- Codex

Possible capabilities:

- Read project context
- Edit files
- Run commands
- Analyze code
- Generate patches
- Execute task workflows

### Runtime

A local model-serving environment.

Examples:

- Ollama
- LM Studio
- llama.cpp

Possible capabilities:

- Chat completion
- Text completion
- Embeddings
- Model listing
- Local inference

### Provider

A specific integration supported by switchboard-ai.

Examples:

- codex
- claude-code
- ollama
- lm-studio

### Capability

A normalized feature that switchboard-ai can expose.

Examples:

- chat
- completion
- agent-task
- code-edit
- model-list
- health-check
- embeddings

## 11. MVP Scope

The first version should focus on a small but useful package for Electron app developers.

### MVP Features

#### 1. Local Tool Discovery

switchboard-ai should detect whether supported local AI tools are available.

Initial discovery targets:

- Claude Code
- Codex
- Ollama

Later:

- LM Studio
- llama.cpp
- OpenAI-compatible localhost endpoints

Discovery methods may include:

- Checking available CLI commands
- Checking known executable paths
- Checking running localhost ports
- Checking environment variables
- Running lightweight health checks
- Detecting version information where possible

#### 2. Unified Provider List

The package should return a normalized list of available tools.

Example:

ts const tools = await discover();  console.log(tools); 

Expected shape:

ts [   {     id: "claude-code",     name: "Claude Code",     type: "agent",     available: true,     version: "x.x.x",     capabilities: ["agent-task", "code-edit"]   },   {     id: "ollama",     name: "Ollama",     type: "runtime",     available: true,     version: "x.x.x",     capabilities: ["chat", "model-list"]   } ] 

#### 3. Unified API

Developers should be able to call a supported local AI tool through one interface.

Example:

ts import { discover, connect } from "switchboard-ai";  const tools = await discover();  const ai = await connect("codex");  const result = await ai.run({   prompt: "Evaluate this TOEFL essay and return structured feedback." }); 

#### 4. Capability-Based Access

Developers should be able to select tools based on capability, not only name.

Example:

ts const agent = await connect({   capability: "agent-task" });  await agent.run({   prompt: "Analyze this project and suggest improvements." }); 

#### 5. Electron Compatibility

The MVP should work well inside Electron main process.

Initial support:

- Node.js runtime
- Electron main process
- macOS first

Later:

- Windows
- Linux
- Electron renderer-safe bridge helpers
- Tauri adapter

#### 6. Safe Defaults

Because some tools may execute commands or access files, switchboard-ai should avoid hiding dangerous behavior.

The package should:

- Clearly expose tool type and capabilities
- Distinguish between passive model calls and agentic actions
- Allow developers to opt into agent execution
- Avoid silently giving broad file-system access
- Document security implications

## 12. Example Developer Experience

### Install

bash npm install switchboard-ai 

### Discover tools

ts import { discover } from "switchboard-ai";  const tools = await discover();  for (const tool of tools) {   console.log(tool.name, tool.available, tool.capabilities); } 

### Connect to a specific tool

ts import { connect } from "switchboard-ai";  const codex = await connect("codex");  const result = await codex.run({   prompt: "Create a test plan for this feature." }); 

### Connect by capability

ts import { connect } from "switchboard-ai";  const ai = await connect({   capability: "agent-task",   prefer: ["claude-code", "codex"] });  const result = await ai.run({   prompt: "Review this codebase and identify bugs." }); 

### Use a local runtime

ts const ai = await connect({   capability: "chat",   prefer: ["ollama"] });  const result = await ai.chat({   messages: [     {       role: "user",       content: "Summarize this essay."     }   ] }); 

## 13. Initial Provider Support

### Claude Code

Type: agent

Capabilities:

- agent-task
- code-analysis
- code-edit

Potential discovery:

- Check CLI availability
- Check version command
- Check auth/setup state if possible

### Codex

Type: agent

Capabilities:

- agent-task
- code-analysis
- code-edit

Potential discovery:

- Check CLI availability
- Check version command
- Check auth/setup state if possible

### Ollama

Type: runtime

Capabilities:

- chat
- completion
- model-list
- embeddings, later

Potential discovery:

- Check ollama CLI
- Check local server endpoint
- Check available models

## 14. Package Architecture

Initial package:

txt switchboard-ai 

Possible future structure:

txt switchboard-ai @switchboard-ai/core @switchboard-ai/electron @switchboard-ai/codex @switchboard-ai/claude-code @switchboard-ai/ollama @switchboard-ai/lm-studio 

For MVP, keep it simple unless modularization becomes necessary.

Suggested internal structure:

txt src/   index.ts   discovery/     discover.ts     types.ts   providers/     codex.ts     claude-code.ts     ollama.ts   capabilities/     types.ts   runtime/     execute.ts   errors/     errors.ts 

## 15. API Design Principles

The API should be:

- Simple
- Typed
- Predictable
- Capability-oriented
- Provider-aware when needed
- Safe by default
- Easy to use in Electron
- Flexible enough for future tools

Avoid:

- Overly abstract agent framework concepts
- Too many configuration options early
- Hiding what tool is actually used
- Naming everything “LLM”
- Assuming every provider is a chat model

## 16. Core API Proposal

### discover()

Finds locally available AI tools.

ts const tools = await discover(); 

Returns:

ts type DiscoveredTool = {   id: string;   name: string;   type: "agent" | "runtime" | "server" | "unknown";   available: boolean;   version?: string;   capabilities: Capability[];   metadata?: Record<string, unknown>; }; 

### connect(toolId)

Connects to a specific tool.

ts const tool = await connect("codex"); 

### connect(options)

Connects to a tool by capability.

ts const tool = await connect({   capability: "agent-task",   prefer: ["claude-code", "codex"] }); 

### tool.run()

Generic execution method for agent-like tools.

ts await tool.run({   prompt: "Analyze this project." }); 

### tool.chat()

Chat method for model-runtime-like tools.

ts await tool.chat({   messages: [{ role: "user", content: "Hello" }] }); 

### tool.health()

Checks whether the tool is usable.

ts await tool.health(); 

## 17. Security Considerations

This product connects applications to local AI tools. Some of those tools may have access to local files, shell commands, or project context.

Security requirements:

- Document that agentic tools may perform actions
- Make capabilities explicit
- Avoid silent command execution inside switchboard-ai itself
- Do not automatically grant file paths unless passed by the developer
- Allow developers to inspect which provider is selected
- Return clear errors when a tool is unavailable or unauthorized
- Prefer explicit opt-in for dangerous capabilities
- Avoid storing prompts or outputs unless the app developer does so

Potential future safety features:

- Permission hints
- Dry-run mode
- Capability risk levels
- Tool sandboxing recommendations
- Provider trust metadata

## 18. Error Handling

Errors should be useful and developer-friendly.

Examples:

ts ToolNotFoundError ToolUnavailableError ToolAuthError CapabilityNotSupportedError ProviderExecutionError TimeoutError 

Example message:

txt Claude Code was detected, but it is not ready to use. Run `claude` in your terminal to complete setup. 

## 19. Success Metrics

Early success:

- Developers understand the product within 10 seconds
- Installation works with one npm command
- Discovery works reliably for at least Codex, Claude Code, and Ollama
- A developer can connect one local AI tool to an Electron app in under 10 minutes
- GitHub README clearly explains the concept
- The package gets used in Open Prep as a real example app

Longer-term success:

- Other developers request new providers
- Community contributes provider adapters
- switchboard-ai becomes the default discovery layer for local AI tools in desktop apps
- Supports Electron, Tauri, Node CLI, and potentially VS Code extensions

## 20. Example Use Cases

### Open Prep

Open Prep can use switchboard-ai to discover locally available AI tools and use them to evaluate writing responses, generate feedback, and power exam-prep workflows.

Example:

- Detect Codex or Claude Code
- Send writing evaluation prompt
- Return structured feedback
- Avoid extra cloud API billing
- Let users use tools they already have installed

### AI-Powered Desktop App

A desktop app wants to add AI features but does not want to force users into one provider.

switchboard-ai allows the app to use local tools when available.

### Developer Tool

A developer tool wants an agent to review code, generate tests, or explain files.

switchboard-ai can connect to Claude