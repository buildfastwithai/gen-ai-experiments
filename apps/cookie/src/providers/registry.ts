// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Provider Registry
// "One registry to find them all."
// ═══════════════════════════════════════════════════════════════

import type { LLMProvider } from './base.js';
import type { CookieConfig } from '../core/config.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider, LMStudioProvider } from './ollama.js';

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string;

  constructor(config: CookieConfig) {
    this.defaultProvider = config.provider.default;
    this.registerAll(config);
  }

  private registerAll(config: CookieConfig): void {
    const keys = config.provider.apiKeys;
    const endpoints = config.provider.endpoints;

    this.register(new OpenAIProvider({ apiKey: keys.openai, model: config.provider.model }));
    this.register(new AnthropicProvider({ apiKey: keys.anthropic }));
    this.register(new GeminiProvider({ apiKey: keys.gemini }));
    this.register(new GroqProvider({ apiKey: keys.groq }));
    this.register(new OpenRouterProvider({ apiKey: keys.openrouter }));
    this.register(new OllamaProvider({ baseUrl: endpoints.ollama }));
    this.register(new LMStudioProvider({ baseUrl: endpoints.lmstudio }));

    if (keys.custom && endpoints.custom) {
      this.register(new OpenAIProvider({ apiKey: keys.custom, baseUrl: endpoints.custom }));
    }
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name?: string): LLMProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" not found. Available: ${this.listProviders().join(', ')}`);
    }
    if (!provider.isAvailable()) {
      throw new Error(`Provider "${providerName}" is not configured. Please set the appropriate API key.`);
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  listAvailable(): string[] {
    return Array.from(this.providers.entries())
      .filter(([, p]) => p.isAvailable())
      .map(([name]) => name);
  }
}
