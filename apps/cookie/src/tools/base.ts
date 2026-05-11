// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Tool Interface
// ═══════════════════════════════════════════════════════════════

import type { ToolDefinition } from '../providers/base.js';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Tool {
  /** Unique tool name (used in function calling) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for parameters */
  parameters: Record<string, unknown>;
  /** Risk level for safety checks */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** Execute the tool */
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

/** Convert a Tool to the provider ToolDefinition format */
export function toolToDefinition(tool: Tool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
