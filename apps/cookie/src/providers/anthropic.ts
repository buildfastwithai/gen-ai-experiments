// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Anthropic Provider
// "The philosophical one."
// ═══════════════════════════════════════════════════════════════

import type {
  LLMProvider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallback,
  ToolCall,
} from './base.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.defaultModel = config.model || 'claude-sonnet-4-20250514';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-haiku-20241022',
    ];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body = this.buildRequestBody(request);
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      model: string;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };
    return this.parseResponse(data);
  }

  async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
    const body = { ...this.buildRequestBody(request), stream: true };
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    let fullContent = '';
    const toolCalls: ToolCall[] = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';

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
        if (!trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);

        try {
          const event = JSON.parse(dataStr) as {
            type: string;
            delta?: { type?: string; text?: string; partial_json?: string };
            content_block?: { type: string; id?: string; name?: string };
          };

          switch (event.type) {
            case 'content_block_start':
              if (event.content_block?.type === 'tool_use') {
                currentToolId = event.content_block.id || '';
                currentToolName = event.content_block.name || '';
                currentToolArgs = '';
              }
              break;

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta' && event.delta.text) {
                fullContent += event.delta.text;
                callback({ type: 'token', content: event.delta.text });
              }
              if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
                currentToolArgs += event.delta.partial_json;
              }
              break;

            case 'content_block_stop':
              if (currentToolId) {
                const toolCall: ToolCall = {
                  id: currentToolId,
                  type: 'function',
                  function: { name: currentToolName, arguments: currentToolArgs },
                };
                toolCalls.push(toolCall);
                callback({ type: 'tool_call', toolCall });
                currentToolId = '';
                currentToolName = '';
                currentToolArgs = '';
              }
              break;

            case 'message_stop':
              callback({ type: 'done' });
              break;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: request.model || this.defaultModel,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  private buildRequestBody(request: CompletionRequest) {
    // Extract system message
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      messages: nonSystemMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolCallId,
                content: m.content,
              },
            ],
          };
        }
        return { role: m.role, content: m.content };
      }),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    return body;
  }

  private parseResponse(data: {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    model: string;
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  }): CompletionResponse {
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        content += block.text;
      }
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id || '',
          type: 'function',
          function: {
            name: block.name || '',
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }
}
