// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Plugin SDK
// "Extensibility: because I can't think of everything."
// ═══════════════════════════════════════════════════════════════

import type { Tool } from '../tools/base.js';

export interface CookiePlugin {
  /** Unique plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Tools provided by this plugin */
  tools?: Tool[];
  /** Called when plugin is loaded */
  onLoad?(): Promise<void>;
  /** Called when plugin is unloaded */
  onUnload?(): Promise<void>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  entry: string;
}

/**
 * Helper to create a plugin
 */
export function definePlugin(plugin: CookiePlugin): CookiePlugin {
  return plugin;
}
