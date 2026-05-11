// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Shell Execution Tool
// "With great shell access comes great responsibility."
// ═══════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import type { Tool, ToolResult } from './base.js';
import { getShellCommand, detectPlatform } from '../platform/detect.js';

export class ShellTool implements Tool {
  name = 'execute_command';
  description = 'Execute a shell command on the system. Returns stdout and stderr. Use with caution.';
  riskLevel: Tool['riskLevel'] = 'high';

  parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
    },
    required: ['command'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string;
    const cwd = (args.cwd as string) || process.cwd();
    const timeout = (args.timeout as number) || 30000;

    const { shell, args: shellArgs } = getShellCommand();

    return new Promise((resolve) => {
      const proc = spawn(shell, [...shellArgs, command], {
        cwd,
        timeout,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        // Windows-specific: use shell mode
        ...(detectPlatform() === 'windows' ? { windowsHide: true } : {}),
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        const output = stdout + (stderr ? `\n[stderr]: ${stderr}` : '');
        resolve({
          success: code === 0,
          output: output.trim() || '(no output)',
          error: code !== 0 ? `Exit code: ${code}` : undefined,
        });
      });

      proc.on('error', (err) => {
        resolve({ success: false, output: '', error: err.message });
      });
    });
  }
}
