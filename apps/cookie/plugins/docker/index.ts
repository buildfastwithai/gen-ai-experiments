// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Example Plugin: Docker
// ═══════════════════════════════════════════════════════════════

import { definePlugin } from '../../src/plugins/sdk.js';
import type { Tool, ToolResult } from '../../src/tools/base.js';
import { ShellTool } from '../../src/tools/shell.js';

const shell = new ShellTool();

class DockerListTool implements Tool {
  name = 'docker_list';
  description = 'List Docker containers (running or all).';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      all: { type: 'boolean', description: 'Show all containers including stopped (default: false)' },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const all = args.all ? ' -a' : '';
    return shell.execute({ command: `docker ps${all} --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"` });
  }
}

class DockerLogsTool implements Tool {
  name = 'docker_logs';
  description = 'Get logs from a Docker container.';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      container: { type: 'string', description: 'Container name or ID' },
      tail: { type: 'number', description: 'Number of lines to show (default: 50)' },
    },
    required: ['container'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const container = args.container as string;
    const tail = (args.tail as number) || 50;
    return shell.execute({ command: `docker logs --tail ${tail} ${container}` });
  }
}

export default definePlugin({
  name: 'docker',
  version: '1.0.0',
  description: 'Docker container management tools',
  tools: [new DockerListTool(), new DockerLogsTool()],
});
