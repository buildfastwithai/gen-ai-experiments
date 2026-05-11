// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — LLM Provider Interface
// "One interface to rule them all."
// ═══════════════════════════════════════════════════════════════

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface CompletionRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  stop?: string[];
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  type: 'token' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * Base interface all LLM providers must implement
 */
export interface LLMProvider {
  readonly name: string;
  readonly displayName: string;

  /**
   * Check if this provider is configured and ready
   */
  isAvailable(): boolean;

  /**
   * List available models
   */
  listModels(): Promise<string[]>;

  /**
   * Send a completion request (non-streaming)
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Send a streaming completion request
   */
  stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse>;
}

/**
 * Configuration for creating a provider
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}
