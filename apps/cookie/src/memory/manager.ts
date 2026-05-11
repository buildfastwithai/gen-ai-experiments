// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Memory System
// "I remember everything. Mostly the embarrassing parts."
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import type { Message } from '../providers/base.js';
import { getPlatformInfo } from '../platform/detect.js';
import { eventBus } from '../core/events.js';

// ── Session Memory (in-process, per conversation) ──

export class SessionMemory {
  private messages: Message[] = [];
  private maxMessages: number;

  constructor(maxMessages = 100) {
    this.maxMessages = maxMessages;
  }

  add(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      const system = this.messages.filter(m => m.role === 'system');
      const recent = this.messages.filter(m => m.role !== 'system').slice(-this.maxMessages + system.length);
      this.messages = [...system, ...recent];
    }
  }

  getMessages(): Message[] { return [...this.messages]; }
  getLastN(n: number): Message[] { return this.messages.slice(-n); }

  clear(): void {
    const system = this.messages.filter(m => m.role === 'system');
    this.messages = system;
  }

  get length(): number { return this.messages.length; }
}

// ── Persistent Memory (sql.js — pure WASM SQLite) ──

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: string;
  timestamp: number;
}

export class PersistentMemory {
  private db: import('sql.js').Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    const platform = getPlatformInfo();
    this.dbPath = dbPath || join(platform.cookieDir, 'memory.db');
  }

  async init(): Promise<void> {
    try {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs();

      // Load existing database file if it exists
      if (existsSync(this.dbPath)) {
        const fileBuffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }

      this.db.run(`
        CREATE TABLE IF NOT EXISTS memory (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          timestamp INTEGER NOT NULL,
          UNIQUE(key, category)
        );
      `);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);`);
      this.db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          summary TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          message_count INTEGER DEFAULT 0
        );
      `);

      this.save();
    } catch (err) {
      console.warn(`⚠️ Could not initialize persistent memory: ${(err as Error).message}`);
      console.warn('  Continuing with session-only memory.');
    }
  }

  private save(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
    } catch { /* ignore save errors */ }
  }

  store(key: string, value: string, category = 'general'): void {
    if (!this.db) return;
    const id = `${category}:${key}`;
    this.db.run(
      `INSERT OR REPLACE INTO memory (id, key, value, category, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [id, key, value, category, Date.now()]
    );
    this.save();
    eventBus.emit('memory:saved', { key, category });
  }

  recall(key: string, category?: string): string | null {
    if (!this.db) return null;
    const stmt = category
      ? this.db.prepare('SELECT value FROM memory WHERE key = ? AND category = ?')
      : this.db.prepare('SELECT value FROM memory WHERE key = ? ORDER BY timestamp DESC LIMIT 1');

    if (category) stmt.bind([key, category]);
    else stmt.bind([key]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      eventBus.emit('memory:recalled', { key, category });
      return (row.value as string) || null;
    }
    stmt.free();
    return null;
  }

  search(query: string, category?: string, limit = 10): MemoryEntry[] {
    if (!this.db) return [];
    const pattern = `%${query}%`;
    const sql = category
      ? `SELECT * FROM memory WHERE category = ? AND (key LIKE ? OR value LIKE ?) ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM memory WHERE key LIKE ? OR value LIKE ? ORDER BY timestamp DESC LIMIT ?`;

    const params = category ? [category, pattern, pattern, limit] : [pattern, pattern, limit];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: MemoryEntry[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as MemoryEntry);
    }
    stmt.free();
    return results;
  }

  listCategories(): string[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT DISTINCT category FROM memory');
    const categories: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      categories.push(row.category as string);
    }
    stmt.free();
    return categories;
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// ── Memory Manager ──

export class MemoryManager {
  session: SessionMemory;
  persistent: PersistentMemory;

  constructor(maxSessionMessages = 100, dbPath?: string) {
    this.session = new SessionMemory(maxSessionMessages);
    this.persistent = new PersistentMemory(dbPath);
  }

  async init(): Promise<void> {
    await this.persistent.init();
  }

  close(): void {
    this.persistent.close();
  }
}
