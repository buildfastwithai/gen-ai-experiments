// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Code Search Tool
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import type { Tool, ToolResult } from './base.js';

export class SearchTool implements Tool {
  name = 'search_code';
  description = 'Search for a pattern in files. Supports regex. Returns matching lines with file paths and line numbers.';
  riskLevel: Tool['riskLevel'] = 'safe';
  parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (string or regex)' },
      path: { type: 'string', description: 'Directory to search in (default: cwd)' },
      filePattern: { type: 'string', description: 'File extension filter, e.g. ".ts" or ".py"' },
      maxResults: { type: 'number', description: 'Max results to return (default: 50)' },
      isRegex: { type: 'boolean', description: 'Treat pattern as regex (default: false)' },
    },
    required: ['pattern'],
  };

  private readonly skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv']);
  private readonly textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.sh', '.bat', '.ps1', '.env', '.sql', '.xml', '.svg']);

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || process.cwd();
    const filePattern = args.filePattern as string | undefined;
    const maxResults = (args.maxResults as number) || 50;
    const isRegex = args.isRegex as boolean;

    if (!existsSync(searchPath)) return { success: false, output: '', error: `Path not found: ${searchPath}` };

    const regex = isRegex ? new RegExp(pattern, 'gi') : null;
    const results: string[] = [];
    this.searchDir(searchPath, searchPath, pattern, regex, filePattern, results, maxResults);

    if (results.length === 0) return { success: true, output: 'No matches found.' };
    return { success: true, output: results.join('\n') };
  }

  private searchDir(base: string, dir: string, pattern: string, regex: RegExp | null, fileExt: string | undefined, results: string[], max: number): void {
    if (results.length >= max) return;
    try {
      for (const entry of readdirSync(dir)) {
        if (results.length >= max) return;
        if (this.skipDirs.has(entry) || entry.startsWith('.')) continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.searchDir(base, fullPath, pattern, regex, fileExt, results, max);
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (fileExt && ext !== fileExt) continue;
          if (!this.textExts.has(ext)) continue;
          if (stat.size > 1024 * 512) continue; // Skip files > 512KB
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= max) return;
              const match = regex ? regex.test(lines[i]) : lines[i].includes(pattern);
              if (match) {
                const rel = relative(base, fullPath);
                results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
              }
              if (regex) regex.lastIndex = 0; // Reset regex state
            }
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
}
