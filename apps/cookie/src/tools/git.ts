// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Git Tool
// ═══════════════════════════════════════════════════════════════

import type { Tool, ToolResult } from './base.js';
import { ShellTool } from './shell.js';

const shell = new ShellTool();

export class GitTool implements Tool {
  name = 'git';
  description = 'Run git commands. Supports status, diff, log, add, commit, branch, checkout, and more.';
  riskLevel: Tool['riskLevel'] = 'medium';
  parameters = {
    type: 'object',
    properties: {
      subcommand: { type: 'string', description: 'Git subcommand (status, diff, log, add, commit, branch, checkout, stash, etc.)' },
      args: { type: 'string', description: 'Additional arguments for the git command' },
      cwd: { type: 'string', description: 'Working directory (defaults to cwd)' },
    },
    required: ['subcommand'],
  };

  // Commands that modify state — need higher caution
  private readonly riskyCommands = new Set([
    'push', 'force-push', 'reset', 'rebase', 'merge', 'clean', 'rm',
  ]);

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const sub = args.subcommand as string;
    const extra = (args.args as string) || '';
    const cwd = (args.cwd as string) || process.cwd();

    // Block force push explicitly
    if (sub === 'push' && extra.includes('--force')) {
      return { success: false, output: '', error: '🛑 Force push blocked by safety system. Use --force-with-lease instead.' };
    }

    const command = `git ${sub} ${extra}`.trim();
    return shell.execute({ command, cwd });
  }
}
