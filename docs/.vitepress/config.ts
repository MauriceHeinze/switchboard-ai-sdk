import { defineConfig } from "vitepress";

const BASE = "/switchboard-ai-sdk/";
const HOSTNAME = "https://mauriceheinze.github.io";

export default defineConfig({
  title: "switchboard-ai-sdk",
  titleTemplate: ":title — switchboard-ai-sdk",
  description:
    "switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools already installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.",
  base: BASE,
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ["link", { rel: "icon", href: `${BASE}logo_icon.svg` }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "switchboard-ai-sdk" }],
    ["meta", { property: "og:image", content: `${BASE}logo_full.svg` }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: `${BASE}logo_full.svg` }],
  ],

  transformHead: ({ pageData }) => {
    const head: [string, Record<string, string>][] = [];
    const canonicalUrl = `${HOSTNAME}${BASE}${pageData.relativePath.replace(/\\.md$/, "").replace(/\/index$/, "")}`;
    head.push(["link", { rel: "canonical", href: canonicalUrl }]);

    if (pageData.relativePath === "index.md") {
      const softwareApplication = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "switchboard-ai-sdk",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Linux, macOS, Windows",
        description:
          "switchboard-ai-sdk is a TypeScript SDK for Node.js and Electron apps that lets developers discover and use local AI tools already installed on a user's machine, including Codex, Claude Code, OpenCode, and Ollama, through one consistent API.",
        version: "0.1.7",
        url: "https://mauriceheinze.github.io/switchboard-ai-sdk/",
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
        author: { "@type": "Person", name: "Maurice Heinze" },
        codeRepository: "https://github.com/MauriceHeinze/switchboard-ai-sdk",
        programmingLanguage: "TypeScript",
      });

      const softwareSourceCode = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "switchboard-ai-sdk",
        programmingLanguage: "TypeScript",
        runtimePlatform: "Node.js, Electron",
        codeRepository: "https://github.com/MauriceHeinze/switchboard-ai-sdk",
        license: "https://opensource.org/license/mit",
        description:
          "TypeScript SDK for discovering and using local AI tools such as Codex, Claude Code, OpenCode, and Ollama through one consistent API.",
      });

      head.push(["script", { type: "application/ld+json" }, softwareApplication]);
      head.push(["script", { type: "application/ld+json" }, softwareSourceCode]);
    }

    return head;
  },

  themeConfig: {
    logo: { src: "/logo_icon.svg", alt: "switchboard-ai-sdk" },

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      {
        text: "Providers",
        items: [
          { text: "Overview", link: "/guide/providers" },
          { text: "Codex", link: "/providers/codex" },
          { text: "Claude Code", link: "/providers/claude-code" },
          { text: "OpenCode", link: "/providers/opencode" },
          { text: "Ollama", link: "/providers/ollama" },
        ],
      },
      {
        text: "Use Cases",
        items: [
          { text: "Electron AI apps", link: "/use-cases/electron-ai-apps" },
          { text: "Local-first AI apps", link: "/use-cases/local-first-ai-apps" },
          { text: "No API cost AI features", link: "/use-cases/no-api-cost-ai-features" },
          { text: "AI provider fallback", link: "/use-cases/ai-provider-fallback" },
          { text: "All four providers", link: "/use-cases/codex-claude-opencode-ollama" },
        ],
      },
      {
        text: "Recipes",
        items: [
          { text: "Discover first available provider", link: "/recipes/discover-first-available-provider" },
          { text: "Connect to Ollama", link: "/recipes/connect-to-ollama" },
          { text: "Use OpenCode free model", link: "/recipes/use-opencode-free-model" },
          { text: "Check auth before chat", link: "/recipes/check-auth-before-chat" },
          { text: "Start HTTP server", link: "/recipes/start-http-server" },
          { text: "Electron main process", link: "/recipes/electron-main-process" },
          { text: "Fallback between providers", link: "/recipes/fallback-between-providers" },
        ],
      },
      { text: "API Reference", link: "/api/reference" },
      { text: "Examples", link: "/examples" },
      {
        text: "More",
        items: [
          { text: "Compare", link: "/compare" },
          { text: "FAQ", link: "/faq" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "Security & Privacy", link: "/security-and-privacy" },
          { text: "For AI Agents", link: "/for-ai-agents" },
          { text: "Changelog", link: "/changelog" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Discovering Tools", link: "/guide/discovery" },
            { text: "Connect & Chat", link: "/guide/connect-chat" },
            { text: "HTTP Server", link: "/guide/http-server" },
            { text: "Providers", link: "/guide/providers" },
            { text: "Error Handling", link: "/guide/errors" },
          ],
        },
      ],
      "/providers/": [
        {
          text: "Providers",
          items: [
            { text: "Overview", link: "/guide/providers" },
            { text: "Codex", link: "/providers/codex" },
            { text: "Claude Code", link: "/providers/claude-code" },
            { text: "OpenCode", link: "/providers/opencode" },
            { text: "Ollama", link: "/providers/ollama" },
          ],
        },
      ],
      "/use-cases/": [
        {
          text: "Use Cases",
          items: [
            { text: "Electron AI apps", link: "/use-cases/electron-ai-apps" },
            { text: "Local-first AI apps", link: "/use-cases/local-first-ai-apps" },
            { text: "No API cost AI features", link: "/use-cases/no-api-cost-ai-features" },
            { text: "AI provider fallback", link: "/use-cases/ai-provider-fallback" },
            { text: "All four providers", link: "/use-cases/codex-claude-opencode-ollama" },
          ],
        },
      ],
      "/recipes/": [
        {
          text: "Recipes",
          items: [
            { text: "Discover first available provider", link: "/recipes/discover-first-available-provider" },
            { text: "Connect to Ollama", link: "/recipes/connect-to-ollama" },
            { text: "Use OpenCode free model", link: "/recipes/use-opencode-free-model" },
            { text: "Check auth before chat", link: "/recipes/check-auth-before-chat" },
            { text: "Start HTTP server", link: "/recipes/start-http-server" },
            { text: "Electron main process", link: "/recipes/electron-main-process" },
            { text: "Fallback between providers", link: "/recipes/fallback-between-providers" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/reference" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/MauriceHeinze/switchboard-ai-sdk" },
    ],

    footer: {
      message: "Released under the MIT License. · <a href=\"/switchboard-ai-sdk/llms.txt\">llms.txt</a>",
      copyright: `Copyright © ${new Date().getFullYear()} Maurice Heinze`,
    },

    search: {
      provider: "local",
    },
  },

  srcExclude: ["API-REFERENCE.md", "SDK-USAGE.md"],

  sitemap: {
    hostname: "https://mauriceheinze.github.io/switchboard-ai-sdk",
  },

  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
  },
});
