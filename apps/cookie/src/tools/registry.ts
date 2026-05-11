// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Tool Registry
// ═══════════════════════════════════════════════════════════════

import type { Tool, ToolResult } from './base.js';
import type { ToolDefinition } from '../providers/base.js';
import { toolToDefinition } from './base.js';
import { eventBus } from '../core/events.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.list().map(toolToDefinition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Tool "${name}" not found` };
    }

    const startTime = Date.now();
    eventBus.emit('tool:start', { toolName: name, input: args });

    try {
      const result = await tool.execute(args);
      const duration = Date.now() - startTime;
      eventBus.emit('tool:result', { toolName: name, output: result.output, duration });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      eventBus.emit('tool:error', { toolName: name, error });
      return { success: false, output: '', error };
    }
  }
}
