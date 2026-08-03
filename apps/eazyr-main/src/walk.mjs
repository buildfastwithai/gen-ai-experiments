// Bounded source-tree walking. Deliberately conservative: a scan that takes ten
// seconds on a big monorepo is a scan nobody runs.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'out', 'target',
  '.next', '.nuxt', '.svelte-kit', '.venv', 'venv', 'env', '__pycache__',
  '.tox', '.mypy_cache', '.pytest_cache', '.gradle', '.idea', '.vscode',
  'coverage', '.cache', '.turbo', '.parcel-cache', 'Pods', 'bin', 'obj',
]);

const SOURCE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte',
  '.py', '.go', '.rs', '.rb', '.php', '.java', '.kt', '.kts', '.cs', '.ex', '.exs',
  '.yml', '.yaml', '.toml', '.json', '.env', '.sh', '.tf',
]);

const MAX_FILES = 4000;
const MAX_DEPTH = 8;
const MAX_FILE_BYTES = 512 * 1024;

/** Walk source files under `root`, returning repo-relative paths with POSIX separators. */
export function walkSources(root, { maxFiles = MAX_FILES } = {}) {
  const found = [];
  let truncated = false;

  const visit = (dir, depth) => {
    if (depth > MAX_DEPTH || found.length >= maxFiles) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory (permissions, broken symlink) — skip it
    }

    for (const entry of entries) {
      if (found.length >= maxFiles) {
        truncated = true;
        return;
      }
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.github') continue;
        visit(full, depth + 1);
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf('.');
        const ext = dot === -1 ? '' : entry.name.slice(dot);
        if (SOURCE_EXT.has(ext) || entry.name.startsWith('.env')) {
          found.push(relative(root, full).split(sep).join('/'));
        }
      }
    }
  };

  visit(root, 0);
  return { files: found, truncated };
}

/** Read a repo-relative file, or null if missing, unreadable, or implausibly large. */
export function read(root, relPath) {
  const full = join(root, relPath);
  try {
    if (statSync(full).size > MAX_FILE_BYTES) return null;
    return readFileSync(full, 'utf8');
  } catch {
    return null;
  }
}

export function readJson(root, relPath) {
  const text = read(root, relPath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // malformed manifest: report absence rather than crashing the scan
  }
}

export function has(root, relPath) {
  return existsSync(join(root, relPath));
}

/** First existing path from `candidates`, or null. */
export function firstOf(root, candidates) {
  return candidates.find((p) => has(root, p)) ?? null;
}
