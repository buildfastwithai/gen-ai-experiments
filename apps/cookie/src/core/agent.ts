// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Core Agent Runtime
// "The brain. The heart. The sarcasm."
// ═══════════════════════════════════════════════════════════════

import type { CookieConfig } from './config.js';
import type { Message, CompletionResponse, StreamChunk } from '../providers/base.js';
import { eventBus } from './events.js';
import { ProviderRegistry } from '../providers/registry.js';
import { ToolRegistry } from '../tools/registry.js';
import { SafetyEngine } from '../safety/engine.js';
import { MemoryManager } from '../memory/manager.js';
import { PersonalityEngine } from '../personality/engine.js';
import { PlanningEngine } from '../planner/engine.js';
import { PluginLoader } from '../plugins/loader.js';

// Tools
import { ShellTool } from '../tools/shell.js';
import { ReadFileTool, WriteFileTool, ListDirTool, DeleteFileTool } from '../tools/filesystem.js';
import { GitTool } from '../tools/git.js';
import { SearchTool } from '../tools/search.js';

export type AgentMode = 'chat' | 'autonomous' | 'plan';

export interface AgentOptions {
  config: CookieConfig;
  mode?: AgentMode;
  provider?: string;
  model?: string;
}

export class CookieAgent {
  private config: CookieConfig;
  private providers: ProviderRegistry;
  private tools: ToolRegistry;
  private safety: SafetyEngine;
  private memory: MemoryManager;
  private personality: PersonalityEngine;
  private planner: PlanningEngine;
  private plugins: PluginLoader;
  private mode: AgentMode;
  private currentProvider: string;
  private currentModel: string;
  private isRunning = false;

  // Callback for confirmation prompts
  onConfirm?: (message: string) => Promise<boolean>;
  // Callback for streaming output
  onStream?: (chunk: StreamChunk) => void;
  // Callback for status updates
  onStatus?: (status: string) => void;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.mode = options.mode || 'chat';
    this.currentProvider = options.provider || options.config.provider.default;
    this.currentModel = options.model || options.config.provider.model;

    // Initialize subsystems
    this.providers = new ProviderRegistry(this.config);
    this.tools = new ToolRegistry();
    this.safety = new SafetyEngine(this.config);
    this.memory = new MemoryManager(
      this.config.memory.sessionMaxMessages,
      this.config.memory.dbPath
    );
    this.personality = new PersonalityEngine(this.config);
    this.planner = new PlanningEngine();
    this.plugins = new PluginLoader(this.tools);

    // Register built-in tools
    this.registerBuiltinTools();
  }

  async init(): Promise<void> {
    await this.memory.init();
    await this.plugins.loadFromDirectory();

    // Add system prompt
    this.memory.session.add({
      role: 'system',
      content: this.personality.getSystemPrompt(),
    });
  }

  /**
   * Process a user message and return the agent's response
   */
  async chat(userMessage: string): Promise<string> {
    this.isRunning = true;
    eventBus.emit('agent:thinking');

    // Add user message to memory
    this.memory.session.add({ role: 'user', content: userMessage });

    try {
      const response = await this.agentLoop();
      this.isRunning = false;
      eventBus.emit('agent:idle');
      return response;
    } catch (err) {
      this.isRunning = false;
      const error = err instanceof Error ? err.message : String(err);
      eventBus.emit('agent:error', { error });
      const quip = this.personality.quip('failure');
      return `${quip}\n\nError: ${error}`;
    }
  }

  /**
   * The core agent loop — handles tool calls iteratively
   */
  private async agentLoop(maxIterations = 10): Promise<string> {
    const provider = this.providers.get(this.currentProvider);
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      const messages = this.memory.session.getMessages();
      const toolDefs = this.tools.getDefinitions();

      let response: CompletionResponse;

      if (this.onStream) {
        eventBus.emit('stream:start');
        response = await provider.stream(
          {
            messages,
            model: this.currentModel,
            temperature: this.config.provider.temperature,
            maxTokens: this.config.provider.maxTokens,
            tools: toolDefs.length > 0 ? toolDefs : undefined,
          },
          this.onStream
        );
        eventBus.emit('stream:end');
      } else {
        response = await provider.complete({
          messages,
          model: this.currentModel,
          temperature: this.config.provider.temperature,
          maxTokens: this.config.provider.maxTokens,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
        });
      }

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        this.memory.session.add({ role: 'assistant', content: response.content });
        return response.content;
      }

      // Handle tool calls
      this.memory.session.add({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown>;

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          this.memory.session.add({
            role: 'tool',
            content: 'Error: Invalid JSON arguments',
            toolCallId: toolCall.id,
          });
          continue;
        }

        // Safety check
        const tool = this.tools.get(toolName);
        if (tool) {
          const safetyCheck = this.safety.checkTool(tool, args);

          if (safetyCheck.requiresConfirmation) {
            const confirmed = await this.requestConfirmation(
              `${SafetyEngine.describeRisk(safetyCheck.risk)}\n` +
              `Tool: ${toolName}\n` +
              `Reason: ${safetyCheck.reason || 'Requires confirmation'}\n` +
              `Args: ${JSON.stringify(args, null, 2)}`
            );

            if (!confirmed) {
              this.memory.session.add({
                role: 'tool',
                content: 'User denied execution of this tool.',
                toolCallId: toolCall.id,
              });
              continue;
            }
          }
        }

        // Execute the tool
        const quip = this.personality.actionQuip(toolName);
        if (quip) this.onStatus?.(quip);

        const result = await this.tools.execute(toolName, args);

        // Check output for secrets
        const secrets = this.safety.scanForSecrets(result.output);
        const output = secrets.length > 0
          ? `[Output redacted — potential secrets detected: ${secrets.join(', ')}]`
          : result.output;

        this.memory.session.add({
          role: 'tool',
          content: result.success ? output : `Error: ${result.error}\n${output}`,
          toolCallId: toolCall.id,
        });
      }
    }

    return 'Reached maximum iterations. Please provide more guidance.';
  }

  private async requestConfirmation(message: string): Promise<boolean> {
    if (this.onConfirm) {
      return this.onConfirm(message);
    }
    // Default: deny if no confirmation handler
    return false;
  }

  private registerBuiltinTools(): void {
    this.tools.register(new ShellTool());
    this.tools.register(new ReadFileTool());
    this.tools.register(new WriteFileTool());
    this.tools.register(new ListDirTool());
    this.tools.register(new DeleteFileTool());
    this.tools.register(new GitTool());
    this.tools.register(new SearchTool());
  }

  // ── Public API ──

  getPersonality(): PersonalityEngine { return this.personality; }
  getPlanner(): PlanningEngine { return this.planner; }
  getMemory(): MemoryManager { return this.memory; }
  getProviders(): ProviderRegistry { return this.providers; }
  getTools(): ToolRegistry { return this.tools; }
  getPluginLoader(): PluginLoader { return this.plugins; }
  getMode(): AgentMode { return this.mode; }
  setMode(mode: AgentMode): void { this.mode = mode; }
  setProvider(name: string): void { this.currentProvider = name; }
  setModel(model: string): void { this.currentModel = model; }
  getIsRunning(): boolean { return this.isRunning; }

  async shutdown(): Promise<void> {
    this.memory.close();
    for (const plugin of this.plugins.listPlugins()) {
      await this.plugins.unloadPlugin(plugin.name);
    }
  }
}
