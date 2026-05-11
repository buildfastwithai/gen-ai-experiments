// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Ollama Provider (local models)
// ═══════════════════════════════════════════════════════════════

import { OpenAIProvider } from './openai.js';
import type { ProviderConfig } from './base.js';

export class OllamaProvider extends OpenAIProvider {
  override readonly name = 'ollama';
  override readonly displayName = 'Ollama (Local)';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      apiKey: 'ollama', // Ollama doesn't need a key but the header is still sent
      baseUrl: (config.baseUrl || 'http://localhost:11434') + '/v1',
      model: config.model || 'llama3.2',
    });
  }

  override isAvailable(): boolean {
    return true; // Always "available" — connection errors are caught at runtime
  }

  override async listModels(): Promise<string[]> {
    try {
      const baseUrl = (this as unknown as { baseUrl: string }).baseUrl.replace('/v1', '');
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return ['llama3.2'];
      const data = await res.json() as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      return ['llama3.2'];
    }
  }
}

// LM Studio is also OpenAI-compatible
export class LMStudioProvider extends OpenAIProvider {
  override readonly name = 'lmstudio';
  override readonly displayName = 'LM Studio (Local)';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      apiKey: 'lm-studio',
      baseUrl: (config.baseUrl || 'http://localhost:1234') + '/v1',
      model: config.model || 'local-model',
    });
  }

  override isAvailable(): boolean { return true; }
  override async listModels(): Promise<string[]> { return ['local-model']; }
}
