<script setup lang="ts">
import { VPButton } from "vitepress/theme";
</script>

<template>
  <div class="hero">
    <div class="hero-inner">
      <img
        class="hero-logo"
        src="/logo_full.svg"
        alt="switchboard-ai-sdk"
      />
      <p class="hero-tagline">
        Connect your app to local AI tools through <strong>one SDK</strong>.
      </p>
      <p class="hero-description">
        TypeScript SDK for discovering and using Codex, Claude Code, OpenCode, and Ollama
        from Node.js or Electron. No hosted API costs, no provider-specific glue code.
      </p>
      <div class="hero-actions">
        <VPButton
          tag="a"
          size="medium"
          theme="brand"
          text="Get Started"
          href="/guide/getting-started"
        />
        <VPButton
          tag="a"
          size="medium"
          theme="alt"
          text="API Reference"
          href="/api/reference"
        />
      </div>
      <div class="hero-install">
        <code>npm install switchboard-ai-sdk</code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  padding: 64px 24px 48px;
  text-align: center;
}

.hero-inner {
  max-width: 720px;
  margin: 0 auto;
}

.hero-logo {
  max-width: 420px;
  width: 100%;
  height: auto;
  margin: 0 auto 24px;
}

.hero-tagline {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--vp-c-text-1);
  margin: 0 0 12px;
}

.hero-description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 560px;
  margin: 0 auto 32px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.hero-install {
  margin-top: 16px;
}

.hero-install code {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 0.95rem;
  color: var(--vp-c-text-1);
}

@media (max-width: 640px) {
  .hero-tagline {
    font-size: 1.5rem;
  }

  .hero-description {
    font-size: 1rem;
  }
}
</style>
