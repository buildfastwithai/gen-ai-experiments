// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Plugin Loader
// ═══════════════════════════════════════════════════════════════

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CookiePlugin } from './sdk.js';
import type { ToolRegistry } from '../tools/registry.js';
import { getPlatformInfo } from '../platform/detect.js';

export class PluginLoader {
  private plugins: Map<string, CookiePlugin> = new Map();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Load a plugin directly
   */
  async loadPlugin(plugin: CookiePlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already loaded.`);
      return;
    }

    await plugin.onLoad?.();

    // Register plugin tools
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.toolRegistry.register(tool);
      }
    }

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Load plugins from the plugins directory
   */
  async loadFromDirectory(dir?: string): Promise<void> {
    const pluginDir = dir || join(getPlatformInfo().cookieDir, 'plugins');
    if (!existsSync(pluginDir)) return;

    for (const entry of readdirSync(pluginDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pluginPath = join(pluginDir, entry.name, 'index.js');
      if (!existsSync(pluginPath)) continue;

      try {
        const mod = await import(`file://${pluginPath}`);
        const plugin = mod.default as CookiePlugin;
        if (plugin?.name) {
          await this.loadPlugin(plugin);
        }
      } catch (err) {
        console.warn(`Failed to load plugin from ${pluginPath}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    await plugin.onUnload?.();

    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.toolRegistry.unregister(tool.name);
      }
    }

    this.plugins.delete(name);
  }

  listPlugins(): CookiePlugin[] {
    return Array.from(this.plugins.values());
  }
}
