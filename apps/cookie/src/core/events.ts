// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Event System
// "Events: because callbacks weren't chaotic enough."
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'events';

export type CookieEventType =
  | 'agent:thinking'
  | 'agent:responding'
  | 'agent:idle'
  | 'agent:error'
  | 'agent:complete'
  | 'stream:token'
  | 'stream:start'
  | 'stream:end'
  | 'tool:start'
  | 'tool:result'
  | 'tool:error'
  | 'safety:warning'
  | 'safety:blocked'
  | 'safety:confirm'
  | 'memory:saved'
  | 'memory:recalled'
  | 'personality:quip'
  | 'plan:created'
  | 'plan:step'
  | 'plan:complete'
  | 'ui:status'
  | 'ui:clear';

export interface CookieEvent {
  type: CookieEventType;
  data: unknown;
  timestamp: number;
}

export interface StreamTokenEvent {
  token: string;
  provider: string;
  model: string;
}

export interface ToolEvent {
  toolName: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface SafetyEvent {
  command: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  approved?: boolean;
}

class CookieEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emit(event: CookieEventType, data?: unknown): boolean {
    return super.emit(event, {
      type: event,
      data,
      timestamp: Date.now(),
    } satisfies CookieEvent);
  }

  on(event: CookieEventType, listener: (event: CookieEvent) => void): this {
    return super.on(event, listener);
  }

  once(event: CookieEventType, listener: (event: CookieEvent) => void): this {
    return super.once(event, listener);
  }

  off(event: CookieEventType, listener: (event: CookieEvent) => void): this {
    return super.off(event, listener);
  }
}

// Singleton event bus
export const eventBus = new CookieEventBus();
