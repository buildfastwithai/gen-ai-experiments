// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Groq Provider (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════

import { OpenAIProvider } from './openai.js';
import type { ProviderConfig } from './base.js';

export class GroqProvider extends OpenAIProvider {
  override readonly name = 'groq';
  override readonly displayName = 'Groq';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      model: config.model || 'llama-3.3-70b-versatile',
    });
  }

  override async listModels(): Promise<string[]> {
    return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
  }
}
