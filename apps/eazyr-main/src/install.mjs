// Installs the Claude Code skill by copying this package's skill files into a
// skills directory. Copy rather than symlink: npx runs from a cache that gets
// cleared, and a dangling symlink is a confusing way to lose a skill.

import { cpSync, mkdirSync, existsSync, copyFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function skillTarget({ project = false, cwd = process.cwd() } = {}) {
  return project
    ? join(cwd, '.claude', 'skills', 'eazyr')
    : join(homedir(), '.claude', 'skills', 'eazyr');
}

export function installSkill({ project = false, force = false, cwd = process.cwd() } = {}) {
  const target = skillTarget({ project, cwd });
  const existed = existsSync(join(target, 'SKILL.md'));

  if (existed && !force) {
    return { target, status: 'exists' };
  }

  mkdirSync(target, { recursive: true });
  copyFileSync(join(PKG_ROOT, 'SKILL.md'), join(target, 'SKILL.md'));
  cpSync(join(PKG_ROOT, 'references'), join(target, 'references'), { recursive: true });
  cpSync(join(PKG_ROOT, 'assets'), join(target, 'assets'), { recursive: true });

  return { target, status: existed ? 'updated' : 'installed' };
}

export function skillVersion() {
  try {
    return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}
