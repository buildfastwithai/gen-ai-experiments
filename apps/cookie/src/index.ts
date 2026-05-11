// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Main Exports
// ═══════════════════════════════════════════════════════════════

export { CookieAgent } from './core/agent.js';
export type { AgentOptions, AgentMode } from './core/agent.js';
export { loadConfig, saveConfig } from './core/config.js';
export type { CookieConfig } from './core/config.js';
export { eventBus } from './core/events.js';
export type { CookieEventType, CookieEvent } from './core/events.js';

// Providers
export type { LLMProvider, ProviderConfig, Message, CompletionRequest, CompletionResponse, StreamChunk, ToolCall, ToolDefinition } from './providers/base.js';
export { ProviderRegistry } from './providers/registry.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { GeminiProvider } from './providers/gemini.js';
export { GroqProvider } from './providers/groq.js';
export { OpenRouterProvider } from './providers/openrouter.js';
export { OllamaProvider, LMStudioProvider } from './providers/ollama.js';

// Tools
export type { Tool, ToolResult } from './tools/base.js';
export { ToolRegistry } from './tools/registry.js';

// Memory
export { MemoryManager, SessionMemory, PersistentMemory } from './memory/manager.js';

// Safety
export { SafetyEngine } from './safety/engine.js';

// Personality
export { PersonalityEngine } from './personality/engine.js';

// Planning
export { PlanningEngine } from './planner/engine.js';

// Plugins
export { definePlugin } from './plugins/sdk.js';
export type { CookiePlugin } from './plugins/sdk.js';
export { PluginLoader } from './plugins/loader.js';

// Platform
export { detectPlatform, detectShell, getPlatformInfo, normalizePath, adaptCommand } from './platform/detect.js';
export type { Platform, ShellType, PlatformInfo } from './platform/detect.js';
