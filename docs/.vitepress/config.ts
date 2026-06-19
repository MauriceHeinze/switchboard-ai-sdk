import { defineConfig } from "vitepress";

const BASE = "/switchboard-ai-sdk/";
const HOSTNAME = "https://mauriceheinze.github.io";

export default defineConfig({
  title: "switchboard-ai-sdk",
  description:
    "TypeScript SDK for connecting local applications to AI tools — Codex, Claude Code, OpenCode, and Ollama — through one API. Local-first, zero API costs.",
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
      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "switchboard-ai-sdk",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Linux, macOS, Windows",
        description:
          "TypeScript SDK for connecting local applications to AI tools like Codex, Claude Code, OpenCode, and Ollama through one API. Discover, connect, and chat — no hosted API costs.",
        version: "0.1.7",
        url: "https://mauriceheinze.github.io/switchboard-ai-sdk/",
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
        author: { "@type": "Person", name: "Maurice Heinze" },
        codeRepository: "https://github.com/MauriceHeinze/switchboard-ai-sdk",
        programmingLanguage: "TypeScript",
      });
      head.push(["script", { type: "application/ld+json" }, jsonLd]);
    }

    return head;
  },

  themeConfig: {
    logo: { src: "/logo_icon.svg", alt: "switchboard-ai-sdk" },

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API Reference", link: "/api/reference" },
      { text: "Examples", link: "/examples" },
      { text: "Changelog", link: "/changelog" },
      {
        text: "v0.1.7",
        items: [
          { text: "npm", link: "https://www.npmjs.com/package/switchboard-ai-sdk" },
          { text: "GitHub", link: "https://github.com/MauriceHeinze/switchboard-ai-sdk" },
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
      message: "Released under the MIT License.",
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
