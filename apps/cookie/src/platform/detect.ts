// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Platform Detection & Adaptation
// "Your OS is just a suggestion, really."
// ═══════════════════════════════════════════════════════════════

import { platform, homedir, tmpdir, arch, release } from 'os';
import { join, normalize, sep, posix, win32 } from 'path';

export type Platform = 'windows' | 'linux' | 'macos';
export type ShellType = 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh' | 'fish' | 'wsl' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  shell: ShellType;
  arch: string;
  release: string;
  homeDir: string;
  tempDir: string;
  pathSeparator: string;
  isWSL: boolean;
  cookieDir: string;
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  const p = platform();
  switch (p) {
    case 'win32': return 'windows';
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    default: return 'linux'; // Default to linux for unknown
  }
}

/**
 * Detect if running inside WSL
 */
export function isWSL(): boolean {
  if (platform() !== 'linux') return false;
  try {
    const releaseStr = release().toLowerCase();
    return releaseStr.includes('microsoft') || releaseStr.includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Detect the current shell type
 */
export function detectShell(): ShellType {
  const p = detectPlatform();

  if (isWSL()) return 'wsl';

  // Check environment variables for shell info
  const shellEnv = process.env.SHELL || '';
  const comSpec = process.env.ComSpec || '';
  const psMod = process.env.PSModulePath;

  if (p === 'windows') {
    // PowerShell sets PSModulePath
    if (psMod) return 'powershell';
    if (comSpec.toLowerCase().includes('cmd.exe')) return 'cmd';
    return 'powershell'; // Default on Windows
  }

  // Unix shells
  if (shellEnv.includes('zsh')) return 'zsh';
  if (shellEnv.includes('fish')) return 'fish';
  if (shellEnv.includes('bash')) return 'bash';
  if (shellEnv.includes('sh')) return 'sh';

  return 'bash'; // Default on Unix
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const p = detectPlatform();
  const home = homedir();
  const cookieDir = join(home, '.cookie');

  return {
    platform: p,
    shell: detectShell(),
    arch: arch(),
    release: release(),
    homeDir: home,
    tempDir: tmpdir(),
    pathSeparator: sep,
    isWSL: isWSL(),
    cookieDir,
  };
}

/**
 * Normalize a path for the current platform
 */
export function normalizePath(inputPath: string): string {
  const p = detectPlatform();
  let normalized = normalize(inputPath);

  if (p === 'windows') {
    // Convert forward slashes to backslashes on Windows
    normalized = normalized.replace(/\//g, '\\');
  } else {
    // Convert backslashes to forward slashes on Unix
    normalized = normalized.replace(/\\/g, '/');
  }

  return normalized;
}

/**
 * Convert path to a POSIX-style path (useful for display/git)
 */
export function toPosixPath(inputPath: string): string {
  return inputPath.split(win32.sep).join(posix.sep);
}

/**
 * Get the appropriate shell command for the platform
 */
export function getShellCommand(): { shell: string; args: string[] } {
  const p = detectPlatform();
  const shell = detectShell();

  if (p === 'windows') {
    if (shell === 'powershell') {
      return { shell: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command'] };
    }
    return { shell: 'cmd.exe', args: ['/c'] };
  }

  // WSL
  if (shell === 'wsl') {
    return { shell: '/bin/bash', args: ['-c'] };
  }

  // Unix
  const unixShell = process.env.SHELL || '/bin/bash';
  return { shell: unixShell, args: ['-c'] };
}

/**
 * Adapt a shell command for the current platform
 */
export function adaptCommand(command: string): string {
  const p = detectPlatform();
  const shell = detectShell();

  if (p !== 'windows') return command;

  // Common Unix → Windows command adaptations
  const adaptations: Record<string, string> = {
    'ls': 'dir',
    'cat': 'type',
    'rm': 'del',
    'cp': 'copy',
    'mv': 'move',
    'mkdir -p': 'mkdir',
    'touch': 'echo. >',
    'which': 'where',
    'clear': 'cls',
    'pwd': 'cd',
  };

  if (shell === 'powershell') {
    // PowerShell has better compatibility, fewer adaptations needed
    const psAdaptations: Record<string, string> = {
      'cat': 'Get-Content',
      'rm -rf': 'Remove-Item -Recurse -Force',
      'rm -r': 'Remove-Item -Recurse',
      'mkdir -p': 'New-Item -ItemType Directory -Force -Path',
    };

    for (const [unix, ps] of Object.entries(psAdaptations)) {
      if (command.startsWith(unix + ' ') || command === unix) {
        command = command.replace(unix, ps);
      }
    }
  } else {
    // CMD adaptations
    for (const [unix, win] of Object.entries(adaptations)) {
      if (command.startsWith(unix + ' ') || command === unix) {
        command = command.replace(unix, win);
      }
    }
  }

  return command;
}

/**
 * Get the correct line ending for the platform
 */
export function getLineEnding(): string {
  return detectPlatform() === 'windows' ? '\r\n' : '\n';
}

/**
 * Get the null device for the platform
 */
export function getNullDevice(): string {
  return detectPlatform() === 'windows' ? 'NUL' : '/dev/null';
}
