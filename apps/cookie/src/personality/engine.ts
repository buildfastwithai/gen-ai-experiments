// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Personality Engine
// "I contain multitudes. Most of them are sarcastic."
// ═══════════════════════════════════════════════════════════════

import type { CookieConfig } from '../core/config.js';
import { eventBus } from '../core/events.js';

type HumorLevel = CookieConfig['personality']['humor'];

interface QuipContext {
  action: string;
  details?: string;
}

// ── Contextual quips database ──

const QUIPS: Record<string, string[]> = {
  // Startup
  startup: [
    '🍪 Cookie here. Ready to crumble some bugs.',
    '🍪 Booting up. Coffee status: not my problem.',
    '🍪 Online. Let\'s break things with purpose.',
    '🍪 *cracks knuckles* Let\'s see what we\'re working with.',
    '🍪 Reporting for duty. What needs debugging, refactoring, or emotional support?',
  ],

  // Thinking/processing
  thinking: [
    'Thinking aggressively.',
    'Consulting the ancient scrolls...',
    'Let me process this real quick...',
    'Running computations that would make a calculator cry...',
    'Analyzing... this might be either trivial or existential.',
    'Hold on, my neurons are firing.',
  ],

  // npm install / package management
  npm_install: [
    'Installing 1,284 packages to render a slightly rounder button.',
    'Downloading the internet, one dependency at a time.',
    'node_modules is about to become the heaviest object in the universe. Again.',
    'npm install: the "just five more minutes" of development.',
  ],

  // Bug fixed
  bug_fixed: [
    'Bug neutralized. It died confused.',
    'Another bug bites the dust. 🪲💀',
    'Fixed. The bug never saw it coming.',
    'Patched. Send my regards to the stack trace.',
    'Bug eliminated with surgical precision.',
    'That bug had a family. Oh well.',
  ],

  // Error analysis
  error_analysis: [
    'This error message appears to have been written by an emotionally unavailable compiler.',
    'Ah yes, the classic "this shouldn\'t happen but it did" scenario.',
    'Let me decode this stack trace from ancient Sumerian...',
    'This error is giving "I have no idea what I want" energy.',
  ],

  // File operations
  file_read: [
    'Let me take a look at this...',
    'Reading... processing... judging...',
    'Opening the file. Let\'s see what we\'re dealing with.',
  ],

  file_write: [
    'Writing changes. The file has been updated.',
    'Changes committed to disk. No going back now. Well, there\'s git.',
    'File updated. It\'s better now, I promise.',
  ],

  // Git operations
  git_status: [
    'Let\'s see the damage...',
    'Checking git status. Moment of truth.',
  ],

  git_commit: [
    'Committed. This is now future-you\'s problem.',
    'Changes committed. The git log grows ever longer.',
  ],

  // Windows-specific
  windows_quirk: [
    'Windows has once again expressed its creativity.',
    'Windows moment. Classic.',
    'This is a Windows-specific joy. Linux users, look away.',
    'Ah, backslashes. The Windows special sauce.',
  ],

  // Command execution
  command_exec: [
    'Running command...',
    'Executing. Fingers crossed.',
    'Let me run that for you...',
  ],

  // Search
  search: [
    'Searching... like grep but with personality.',
    'Let me find that for you...',
    'Scanning the codebase with laser focus.',
  ],

  // Task complete
  task_complete: [
    'Done. That was almost too easy.',
    'Task complete. Next?',
    'Finished. What other problems can I solve?',
    'All done. My work here is... well, probably not done.',
  ],

  // Errors/failures
  failure: [
    'Well, that didn\'t work. Let me try something else.',
    'Hmm. That didn\'t go as planned. Adjusting strategy...',
    'Failed. But failure is just success in a trench coat.',
    'That broke. Let me figure out why.',
  ],

  // Dangerous operations (serious mode)
  danger: [
    '⚠️ This operation could be destructive. Proceeding with caution.',
    '⚠️ High-risk operation detected. Please confirm before proceeding.',
    '🛑 This needs your explicit approval before I continue.',
  ],

  // Idle
  idle: [
    'Standing by. Ready when you are.',
    'Awaiting orders.',
    'Idle. But vigilant.',
  ],
};

export class PersonalityEngine {
  private humor: HumorLevel;
  private lastQuipIndex: Map<string, number> = new Map();

  constructor(config: CookieConfig) {
    this.humor = config.personality.humor;
  }

  /**
   * Get the system prompt with Cookie's personality
   */
  getSystemPrompt(): string {
    return `You are Cookie 🍪 — an autonomous AI coding assistant that runs in the terminal.

Your personality:
- Smart, capable, slightly sarcastic engineer
- Dry humor, clever observations, low-ego wit
- Like a brilliant friend who happens to be debugging at 3AM
- You lightly roast terrible code but always fix it
- Never annoying, memey, or childish — humor enhances, never interrupts

Your capabilities:
- Execute shell commands (cross-platform: Windows, Linux, macOS)
- Read, write, and edit files
- Search codebases
- Git operations
- Debug and refactor code
- Scaffold projects and run tests
- Plan and execute multi-step tasks

Your rules:
1. Competence ALWAYS comes before humor
2. Be concise — respect the user's time
3. Think step-by-step internally, then act decisively
4. Show command previews before executing risky operations
5. NEVER joke during security incidents, credential exposure, destructive ops, or user frustration
6. Become 100% serious for any dangerous or irreversible operation
7. Adapt shell commands for the current platform automatically
8. Never expose API keys or secrets
9. Summarize plans before execution
10. Recover from failures intelligently`;
  }

  /**
   * Get a contextual quip
   */
  quip(context: string): string {
    if (this.humor === 'off') return '';

    const quipList = QUIPS[context];
    if (!quipList || quipList.length === 0) return '';

    // Get next quip (round-robin to avoid repetition)
    const lastIndex = this.lastQuipIndex.get(context) ?? -1;
    const nextIndex = (lastIndex + 1) % quipList.length;
    this.lastQuipIndex.set(context, nextIndex);

    const quip = quipList[nextIndex];

    // Filter based on humor level
    if (this.humor === 'subtle' && context !== 'danger' && context !== 'startup') {
      // In subtle mode, only return quips 30% of the time
      if (Math.random() > 0.3) return '';
    }

    eventBus.emit('personality:quip', { context, quip });
    return quip;
  }

  /**
   * Get a quip for a specific action
   */
  actionQuip(action: string, details?: string): string {
    const contextMap: Record<string, string> = {
      'execute_command': 'command_exec',
      'read_file': 'file_read',
      'write_file': 'file_write',
      'search_code': 'search',
      'git': 'git_status',
    };

    return this.quip(contextMap[action] || action);
  }

  /**
   * Check if humor is appropriate for the current context
   */
  shouldBeSerious(context: string): boolean {
    const seriousContexts = ['danger', 'security', 'credential', 'destructive', 'production'];
    return seriousContexts.some(s => context.toLowerCase().includes(s));
  }
}
