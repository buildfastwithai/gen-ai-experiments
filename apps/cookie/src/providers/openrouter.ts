// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — OpenRouter Provider (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════

import { OpenAIProvider } from './openai.js';
import type { ProviderConfig } from './base.js';

export class OpenRouterProvider extends OpenAIProvider {
  override readonly name = 'openrouter';
  override readonly displayName = 'OpenRouter';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      model: config.model || 'anthropic/claude-sonnet-4-20250514',
    });
  }

  override async listModels(): Promise<string[]> {
    return [
      'anthropic/claude-sonnet-4-20250514',
      'openai/gpt-4o',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ];
  }
}
