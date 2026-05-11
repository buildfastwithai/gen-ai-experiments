// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Filesystem Tool
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join, relative, basename } from 'path';
import type { Tool, ToolResult } from './base.js';

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Read the contents of a file at the given path.';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file' },
      startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
      endLine: { type: 'number', description: 'End line (1-indexed, optional)' },
    },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string;
    try {
      if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${filePath}` };
      let content = readFileSync(filePath, 'utf-8');
      const start = args.startLine as number | undefined;
      const end = args.endLine as number | undefined;
      if (start || end) {
        const lines = content.split('\n');
        const s = Math.max(1, start || 1) - 1;
        const e = Math.min(lines.length, end || lines.length);
        content = lines.slice(s, e).join('\n');
      }
      return { success: true, output: content };
    } catch (err) {
      return { success: false, output: '', error: (err as Error).message };
    }
  }
}

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Write content to a file. Creates the file and parent directories if they don\'t exist.';
  riskLevel: Tool['riskLevel'] = 'medium';
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to write the file' },
      content: { type: 'string', description: 'Content to write' },
      append: { type: 'boolean', description: 'Append instead of overwrite (default: false)' },
    },
    required: ['path', 'content'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string;
    const content = args.content as string;
    const append = args.append as boolean;
    try {
      const dir = join(filePath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (append && existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8');
        writeFileSync(filePath, existing + content, 'utf-8');
      } else {
        writeFileSync(filePath, content, 'utf-8');
      }
      return { success: true, output: `Written to ${filePath}` };
    } catch (err) {
      return { success: false, output: '', error: (err as Error).message };
    }
  }
}

export class ListDirTool implements Tool {
  name = 'list_directory';
  description = 'List files and directories in a path.';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list' },
      recursive: { type: 'boolean', description: 'List recursively (default: false)' },
    },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = args.path as string;
    const recursive = args.recursive as boolean;
    try {
      if (!existsSync(dirPath)) return { success: false, output: '', error: `Directory not found: ${dirPath}` };
      const entries = this.listDir(dirPath, dirPath, recursive, 0);
      return { success: true, output: entries.join('\n') };
    } catch (err) {
      return { success: false, output: '', error: (err as Error).message };
    }
  }

  private listDir(base: string, dir: string, recursive: boolean, depth: number): string[] {
    if (depth > 5) return ['  ... (max depth reached)'];
    const entries: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const rel = relative(base, fullPath);
      const stat = statSync(fullPath);
      const prefix = '  '.repeat(depth);
      if (stat.isDirectory()) {
        entries.push(`${prefix}📁 ${rel}/`);
        if (recursive) entries.push(...this.listDir(base, fullPath, true, depth + 1));
      } else {
        entries.push(`${prefix}📄 ${rel} (${this.formatSize(stat.size)})`);
      }
    }
    return entries;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

export class DeleteFileTool implements Tool {
  name = 'delete_file';
  description = 'Delete a file at the given path. Use with extreme caution.';
  riskLevel: Tool['riskLevel'] = 'critical';
  parameters = {
    type: 'object',
    properties: { path: { type: 'string', description: 'Path to delete' } },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string;
    try {
      if (!existsSync(filePath)) return { success: false, output: '', error: 'File not found' };
      unlinkSync(filePath);
      return { success: true, output: `Deleted: ${basename(filePath)}` };
    } catch (err) {
      return { success: false, output: '', error: (err as Error).message };
    }
  }
}
