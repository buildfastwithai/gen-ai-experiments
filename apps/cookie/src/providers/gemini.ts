// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Gemini Provider
// ═══════════════════════════════════════════════════════════════

import type {
  LLMProvider, ProviderConfig, CompletionRequest,
  CompletionResponse, StreamCallback, ToolCall,
} from './base.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly displayName = 'Google Gemini';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = config.model || 'gemini-2.5-flash';
  }

  isAvailable(): boolean { return !!this.apiKey; }
  async listModels(): Promise<string[]> { return ['gemini-2.5-pro','gemini-2.5-flash','gemini-2.0-flash']; }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const body = this.buildBody(request);
    const res = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`);
    return this.parseResponse(await res.json() as GeminiResponse, model);
  }

  async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const body = this.buildBody(request);
    const res = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`);

    let fullContent = ''; const toolCalls: ToolCall[] = []; let idx = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder(); let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim().startsWith('data: ')) continue;
        try {
          const chunk = JSON.parse(line.trim().slice(6)) as GeminiResponse;
          for (const part of chunk.candidates?.[0]?.content?.parts || []) {
            if (part.text) { fullContent += part.text; callback({ type: 'token', content: part.text }); }
            if (part.functionCall) {
              const tc: ToolCall = { id: `call_${idx++}`, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } };
              toolCalls.push(tc); callback({ type: 'tool_call', toolCall: tc });
            }
          }
        } catch { /* skip */ }
      }
    }
    callback({ type: 'done' });
    return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, model, finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop' };
  }

  private buildBody(request: CompletionRequest) {
    const sys = request.messages.find(m => m.role === 'system');
    const contents = request.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }],
    }));
    const body: Record<string, unknown> = { contents, generationConfig: { temperature: request.temperature ?? 0.7, maxOutputTokens: request.maxTokens ?? 4096 } };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    if (request.tools?.length) body.tools = [{ functionDeclarations: request.tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }];
    return body;
  }

  private parseResponse(data: GeminiResponse, model: string): CompletionResponse {
    let content = ''; const toolCalls: ToolCall[] = []; let idx = 0;
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.text) content += part.text;
      if (part.functionCall) toolCalls.push({ id: `call_${idx++}`, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } });
    }
    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, model, usage: data.usageMetadata ? { promptTokens: data.usageMetadata.promptTokenCount, completionTokens: data.usageMetadata.candidatesTokenCount, totalTokens: data.usageMetadata.totalTokenCount } : undefined, finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop' };
  }
}

interface GeminiResponse {
  candidates?: Array<{ content: { parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> }; finishReason: string }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
}
