// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — OpenAI Provider
// "The OG. Respectable, if expensive."
// ═══════════════════════════════════════════════════════════════

import type {
  LLMProvider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallback,
  StreamChunk,
  Message,
  ToolCall,
} from './base.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.defaultModel = config.model || 'gpt-4o';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) return [this.defaultModel];
    const data = (await res.json()) as { data: Array<{ id: string }> };
    return data.data
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith('gpt'))
      .sort();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body = this.buildRequestBody(request, false);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      choices: Array<{
        message: { content?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> };
        finish_reason: string;
      }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    return this.parseResponse(data);
  }

  async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
    const body = this.buildRequestBody(request, true);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    let fullContent = '';
    const toolCalls: ToolCall[] = [];
    const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') {
          callback({ type: 'done' });
          continue;
        }

        try {
          const chunk = JSON.parse(dataStr) as {
            choices: Array<{
              delta: {
                content?: string;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string;
            }>;
          };
          const delta = chunk.choices?.[0]?.delta;

          if (delta?.content) {
            fullContent += delta.content;
            callback({ type: 'token', content: delta.content });
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                toolCallBuffers.set(tc.index, {
                  id: tc.id,
                  name: tc.function?.name || '',
                  args: tc.function?.arguments || '',
                });
              } else {
                const existing = toolCallBuffers.get(tc.index);
                if (existing && tc.function?.arguments) {
                  existing.args += tc.function.arguments;
                }
              }
            }
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    // Convert tool call buffers to tool calls
    for (const [, buf] of toolCallBuffers) {
      const toolCall: ToolCall = {
        id: buf.id,
        type: 'function',
        function: { name: buf.name, arguments: buf.args },
      };
      toolCalls.push(toolCall);
      callback({ type: 'tool_call', toolCall });
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: request.model || this.defaultModel,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  private buildRequestBody(request: CompletionRequest, stream: boolean) {
    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      messages: request.messages.map((m) => this.formatMessage(m)),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      stream,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    if (request.stop) {
      body.stop = request.stop;
    }

    if (stream) {
      body.stream_options = { include_usage: true };
    }

    return body;
  }

  private formatMessage(msg: Message) {
    const formatted: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.toolCallId) {
      formatted.tool_call_id = msg.toolCallId;
    }

    if (msg.toolCalls) {
      formatted.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      }));
    }

    return formatted;
  }

  private parseResponse(data: {
    choices: Array<{
      message: { content?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> };
      finish_reason: string;
    }>;
    model: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }): CompletionResponse {
    const choice = data.choices[0];
    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: tc.type as 'function',
      function: tc.function,
    }));

    return {
      content: choice.message.content || '',
      toolCalls,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    };
  }
}
