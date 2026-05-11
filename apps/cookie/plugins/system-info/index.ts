// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Example Plugin: System Info
// ═══════════════════════════════════════════════════════════════

import { definePlugin } from '../../src/plugins/sdk.js';
import type { Tool, ToolResult } from '../../src/tools/base.js';
import { getPlatformInfo } from '../../src/platform/detect.js';
import { cpus, totalmem, freemem, uptime, hostname, userInfo } from 'os';

class SystemInfoTool implements Tool {
  name = 'system_info';
  description = 'Get detailed system information including OS, CPU, memory, and uptime.';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        enum: ['all', 'os', 'cpu', 'memory', 'network'],
        description: 'Which section of system info to return (default: all)',
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const section = (args.section as string) || 'all';
    const platform = getPlatformInfo();
    const lines: string[] = [];

    if (section === 'all' || section === 'os') {
      lines.push('=== OS ===');
      lines.push(`Platform: ${platform.platform}`);
      lines.push(`Shell: ${platform.shell}`);
      lines.push(`Arch: ${platform.arch}`);
      lines.push(`Hostname: ${hostname()}`);
      lines.push(`User: ${userInfo().username}`);
      lines.push(`Uptime: ${Math.floor(uptime() / 3600)}h ${Math.floor((uptime() % 3600) / 60)}m`);
      lines.push('');
    }

    if (section === 'all' || section === 'cpu') {
      const cpuInfo = cpus();
      lines.push('=== CPU ===');
      lines.push(`Model: ${cpuInfo[0]?.model || 'Unknown'}`);
      lines.push(`Cores: ${cpuInfo.length}`);
      lines.push(`Speed: ${cpuInfo[0]?.speed || 0} MHz`);
      lines.push('');
    }

    if (section === 'all' || section === 'memory') {
      const totalGB = (totalmem() / (1024 ** 3)).toFixed(1);
      const freeGB = (freemem() / (1024 ** 3)).toFixed(1);
      const usedGB = ((totalmem() - freemem()) / (1024 ** 3)).toFixed(1);
      lines.push('=== Memory ===');
      lines.push(`Total: ${totalGB} GB`);
      lines.push(`Used: ${usedGB} GB`);
      lines.push(`Free: ${freeGB} GB`);
      lines.push(`Usage: ${Math.round(((totalmem() - freemem()) / totalmem()) * 100)}%`);
    }

    return { success: true, output: lines.join('\n') };
  }
}

export default definePlugin({
  name: 'system-info',
  version: '1.0.0',
  description: 'Provides system information tools (OS, CPU, memory)',
  tools: [new SystemInfoTool()],
});
