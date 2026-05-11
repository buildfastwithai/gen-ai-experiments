// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Configuration System
// "Settings: where good defaults go to be overridden."
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getPlatformInfo } from '../platform/detect.js';

// Schema for Cookie configuration
export const CookieConfigSchema = z.object({
  // Provider settings
  provider: z.object({
    default: z.enum([
      'openai', 'anthropic', 'gemini', 'groq',
      'openrouter', 'ollama', 'lmstudio', 'custom'
    ]).default('openai'),
    model: z.string().default('gpt-4o'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(200000).default(4096),
    apiKeys: z.object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      gemini: z.string().optional(),
      groq: z.string().optional(),
      openrouter: z.string().optional(),
      custom: z.string().optional(),
    }).default({}),
    endpoints: z.object({
      ollama: z.string().default('http://localhost:11434'),
      lmstudio: z.string().default('http://localhost:1234'),
      custom: z.string().optional(),
    }).default({}),
  }).default({}),

  // Safety settings
  safety: z.object({
    mode: z.enum(['strict', 'normal', 'yolo']).default('normal'),
    confirmDestructive: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    blockedCommands: z.array(z.string()).default([]),
  }).default({}),

  // Memory settings
  memory: z.object({
    enabled: z.boolean().default(true),
    dbPath: z.string().optional(),
    sessionMaxMessages: z.number().default(100),
    persistentEnabled: z.boolean().default(true),
  }).default({}),

  // Personality settings
  personality: z.object({
    humor: z.enum(['off', 'subtle', 'normal', 'chaotic']).default('normal'),
    verbose: z.boolean().default(false),
  }).default({}),

  // UI settings
  ui: z.object({
    theme: z.enum(['hacker', 'minimal', 'colorful']).default('hacker'),
    showTimestamps: z.boolean().default(false),
    streamingSpeed: z.enum(['instant', 'fast', 'normal']).default('fast'),
  }).default({}),
});

export type CookieConfig = z.infer<typeof CookieConfigSchema>;

/**
 * Load configuration from environment + config file
 */
export function loadConfig(overrides?: Partial<CookieConfig>): CookieConfig {
  const platform = getPlatformInfo();
  const configPath = join(platform.cookieDir, 'config.json');

  let fileConfig: Record<string, unknown> = {};

  // Try loading config file
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Config file is corrupted, ignore it
    }
  }

  // Merge environment variables
  const envConfig = {
    provider: {
      default: process.env.COOKIE_DEFAULT_PROVIDER,
      model: process.env.COOKIE_DEFAULT_MODEL,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        groq: process.env.GROQ_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        custom: process.env.CUSTOM_API_KEY,
      },
      endpoints: {
        ollama: process.env.OLLAMA_BASE_URL,
        lmstudio: process.env.LMSTUDIO_BASE_URL,
        custom: process.env.CUSTOM_BASE_URL,
      },
    },
    safety: {
      mode: process.env.COOKIE_SAFETY_MODE,
    },
    personality: {
      verbose: process.env.COOKIE_VERBOSE === 'true',
    },
    memory: {
      dbPath: process.env.COOKIE_MEMORY_PATH,
    },
  };

  // Deep merge: defaults → file → env → overrides
  const merged = deepMerge(
    {},
    fileConfig,
    stripUndefined(envConfig),
    overrides || {}
  );

  return CookieConfigSchema.parse(merged);
}

/**
 * Save configuration to file
 */
export function saveConfig(config: CookieConfig): void {
  const platform = getPlatformInfo();
  const configDir = platform.cookieDir;
  const configPath = join(configDir, 'config.json');

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Strip API keys before saving to file (they should stay in env)
  const safeConfig = { ...config };
  if (safeConfig.provider) {
    safeConfig.provider = { ...safeConfig.provider, apiKeys: {} as CookieConfig['provider']['apiKeys'] };
  }

  writeFileSync(configPath, JSON.stringify(safeConfig, null, 2), 'utf-8');
}

// ── Utility helpers ──

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const stripped = stripUndefined(value as Record<string, unknown>);
      if (Object.keys(stripped).length > 0) {
        result[key] = stripped;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

function deepMerge(...objects: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
