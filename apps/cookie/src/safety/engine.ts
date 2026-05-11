// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Safety Engine
// "I'm not paranoid, I'm professionally cautious."
// ═══════════════════════════════════════════════════════════════

import { eventBus } from '../core/events.js';
import type { CookieConfig } from '../core/config.js';
import type { Tool } from '../tools/base.js';

export interface SafetyCheck {
  allowed: boolean;
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  requiresConfirmation: boolean;
}

// Dangerous command patterns (cross-platform)
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; risk: SafetyCheck['risk']; reason: string }> = [
  // Destructive file operations
  { pattern: /rm\s+(-rf?|--recursive)\s/i, risk: 'critical', reason: 'Recursive file deletion' },
  { pattern: /rmdir\s+\/s/i, risk: 'critical', reason: 'Recursive directory deletion (Windows)' },
  { pattern: /del\s+\/[fFsSqQ]/i, risk: 'critical', reason: 'Force file deletion (Windows)' },
  { pattern: /Remove-Item\s.*-Recurse/i, risk: 'critical', reason: 'Recursive deletion (PowerShell)' },
  { pattern: /format\s+[a-zA-Z]:/i, risk: 'critical', reason: 'Disk formatting' },

  // Privilege escalation
  { pattern: /\bsudo\b/i, risk: 'high', reason: 'Elevated privilege command' },
  { pattern: /\brunas\b/i, risk: 'high', reason: 'Elevated privilege command (Windows)' },

  // System modifications
  { pattern: /\breg\s+(add|delete|import)/i, risk: 'critical', reason: 'Windows Registry modification' },
  { pattern: /\bchmod\s+777/i, risk: 'high', reason: 'Overly permissive file permissions' },
  { pattern: /\bchown\b/i, risk: 'medium', reason: 'File ownership change' },

  // Package management (destructive)
  { pattern: /npm\s+(uninstall|remove)\s/i, risk: 'medium', reason: 'Package removal' },
  { pattern: /pip\s+uninstall/i, risk: 'medium', reason: 'Python package removal' },
  { pattern: /apt-get\s+(remove|purge)/i, risk: 'high', reason: 'System package removal' },

  // Git destructive
  { pattern: /git\s+push\s+.*--force(?!\-with\-lease)/i, risk: 'critical', reason: 'Git force push (use --force-with-lease)' },
  { pattern: /git\s+reset\s+--hard/i, risk: 'high', reason: 'Hard git reset (may lose uncommitted changes)' },
  { pattern: /git\s+clean\s+-[fFdDxX]/i, risk: 'high', reason: 'Git clean (removes untracked files)' },

  // Network/secrets
  { pattern: /curl\s+.*\|\s*(ba)?sh/i, risk: 'critical', reason: 'Piping remote script to shell' },
  { pattern: /wget\s+.*\|\s*(ba)?sh/i, risk: 'critical', reason: 'Piping remote script to shell' },

  // Environment danger
  { pattern: /\bexport\b.*(_KEY|_SECRET|_TOKEN|PASSWORD)/i, risk: 'high', reason: 'Potential secret exposure' },
  { pattern: /echo\s+.*(_KEY|_SECRET|_TOKEN|PASSWORD)/i, risk: 'high', reason: 'Potential secret exposure' },

  // System shutdown/reboot
  { pattern: /\b(shutdown|reboot|halt|poweroff)\b/i, risk: 'critical', reason: 'System shutdown/reboot' },
  { pattern: /Stop-Computer|Restart-Computer/i, risk: 'critical', reason: 'System shutdown/reboot (PowerShell)' },
];

export class SafetyEngine {
  private mode: CookieConfig['safety']['mode'];
  private blockedCommands: string[];

  constructor(config: CookieConfig) {
    this.mode = config.safety.mode;
    this.blockedCommands = config.safety.blockedCommands;
  }

  /**
   * Check if a command is safe to execute
   */
  checkCommand(command: string): SafetyCheck {
    // YOLO mode — no checks (you monster)
    if (this.mode === 'yolo') {
      return { allowed: true, risk: 'safe', requiresConfirmation: false };
    }

    // Check blocked commands
    for (const blocked of this.blockedCommands) {
      if (command.includes(blocked)) {
        return { allowed: false, risk: 'critical', reason: `Command contains blocked pattern: "${blocked}"`, requiresConfirmation: true };
      }
    }

    // Check dangerous patterns
    for (const { pattern, risk, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        const allowed = this.mode === 'normal' ? risk !== 'critical' : false;
        eventBus.emit('safety:warning', { command, risk, reason });
        return { allowed, risk, reason, requiresConfirmation: true };
      }
    }

    return { allowed: true, risk: 'safe', requiresConfirmation: false };
  }

  /**
   * Check a tool execution
   */
  checkTool(tool: Tool, args: Record<string, unknown>): SafetyCheck {
    if (this.mode === 'yolo') return { allowed: true, risk: 'safe', requiresConfirmation: false };

    // Shell commands get extra scrutiny
    if (tool.name === 'execute_command' && args.command) {
      return this.checkCommand(args.command as string);
    }

    // File deletions
    if (tool.name === 'delete_file') {
      return { allowed: true, risk: 'high', reason: 'File deletion', requiresConfirmation: true };
    }

    // Map tool risk levels
    const requiresConfirmation = this.mode === 'strict'
      ? tool.riskLevel !== 'safe'
      : tool.riskLevel === 'high' || tool.riskLevel === 'critical';

    return {
      allowed: true,
      risk: tool.riskLevel,
      requiresConfirmation,
    };
  }

  /**
   * Scan text for potential secret leaks
   */
  scanForSecrets(text: string): string[] {
    const patterns = [
      { name: 'API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi },
      { name: 'Secret', pattern: /(?:secret|password|token)\s*[:=]\s*['"]?([a-zA-Z0-9_!@#$%^&*-]{8,})['"]?/gi },
      { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
      { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
    ];

    const found: string[] = [];
    for (const { name, pattern } of patterns) {
      if (pattern.test(text)) found.push(name);
      pattern.lastIndex = 0;
    }
    return found;
  }

  /**
   * Get a human-readable risk description
   */
  static describeRisk(risk: SafetyCheck['risk']): string {
    const descriptions: Record<SafetyCheck['risk'], string> = {
      safe: '✅ Safe',
      low: '🟢 Low risk',
      medium: '🟡 Medium risk — review before proceeding',
      high: '🟠 High risk — could cause data loss or system changes',
      critical: '🔴 Critical — potentially destructive or irreversible',
    };
    return descriptions[risk];
  }
}
