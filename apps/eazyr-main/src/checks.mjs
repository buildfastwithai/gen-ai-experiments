// Derives prerequisite checks from scan facts, and runs them.
//
// The same derivation feeds two outputs: `eazyr doctor` (run now, no files
// written) and the generated scripts/doctor.{sh,ps1} (committed, runs anywhere).
// One source of truth means the committed script can't drift from the tool.

import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Compare dotted versions numerically. String compare gets "9" > "10" wrong. */
export function versionAtLeast(current, minimum) {
  const clean = (v) => String(v ?? '').match(/\d+(\.\d+)*/)?.[0] ?? '';
  const a = clean(current);
  if (!a) return false;
  const left = a.split('.').map(Number);
  const right = clean(minimum).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

/** Lowest version satisfying a range like ">=20", "^3.11", "20.x", "~> 3.2". */
export function minimumOf(range) {
  if (!range) return null;
  const m = String(range).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [m[1], m[2] ?? '0', m[3] ?? '0'].join('.');
}

/**
 * Run a binary and capture its first output line, or null if it isn't runnable.
 *
 * On Windows, package managers are .cmd shims that execFile can't launch directly.
 * Try the extensions explicitly rather than passing `shell: true`, which
 * concatenates arguments unescaped (Node DEP0190).
 */
function tryExec(bin, args, { capture = true } = {}) {
  // Direct exec first, then cmd.exe as a fallback. Since Node 18.20/20.12,
  // execFile refuses to launch .cmd/.bat shims (CVE-2024-27980) — which is how
  // npm, pnpm, and yarn are installed on Windows. cmd.exe is a real executable,
  // so this resolves the shim without `shell: true` and its DEP0190 warning.
  const attempts = [[bin, args]];
  if (process.platform === 'win32') attempts.push(['cmd.exe', ['/d', '/s', '/c', bin, ...args]]);

  for (const [command, commandArgs] of attempts) {
    try {
      const out = execFileSync(command, commandArgs, {
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'ignore'] : 'ignore',
        timeout: 8000,
        windowsHide: true,
      });
      return capture ? (out.trim().split('\n')[0] ?? '') : '';
    } catch (error) {
      // ENOENT (not on PATH) and EINVAL (a shim we're not allowed to exec) are
      // both worth a retry. A non-zero exit means we found it and it answered.
      if (error.code !== 'ENOENT' && error.code !== 'EINVAL') return null;
    }
  }
  return null;
}

function commandVersion(bin, args = ['--version']) {
  return tryExec(bin, args);
}

function portInUse(port, timeout = 400) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

const RUNTIME_BINS = {
  node: { bin: 'node', label: 'Node.js', install: 'https://nodejs.org (or: nvm install {v})' },
  python: { bin: 'python', label: 'Python', install: 'https://python.org/downloads' },
  go: { bin: 'go', label: 'Go', install: 'https://go.dev/dl' },
  rust: { bin: 'cargo', label: 'Rust', install: 'https://rustup.rs' },
  jvm: { bin: 'java', label: 'Java', install: 'https://adoptium.net' },
  ruby: { bin: 'ruby', label: 'Ruby', install: 'https://rubyinstaller.org or rbenv install {v}' },
};

const MANAGER_FIX = {
  pnpm: 'corepack enable && corepack prepare pnpm@latest --activate',
  yarn: 'corepack enable && corepack prepare yarn@stable --activate',
  bun: 'https://bun.sh',
  poetry: 'pipx install poetry',
  uv: 'pipx install uv (or: curl -LsSf https://astral.sh/uv/install.sh | sh)',
  pipenv: 'pipx install pipenv',
  bundler: 'gem install bundler',
};

/**
 * Build the check list from scan facts.
 * Each check: { id, label, severity, fix, kind, ...kind-specific fields }
 */
export function deriveChecks(facts) {
  const checks = [];

  for (const eco of facts.ecosystems) {
    const runtime = RUNTIME_BINS[eco.id];
    if (!runtime) continue;
    const min = minimumOf(Object.values(eco.versions ?? {})[0]);

    checks.push({
      id: `runtime-${eco.id}`,
      kind: 'version',
      label: min ? `${runtime.label} >= ${min}` : `${runtime.label} installed`,
      bin: runtime.bin,
      versionArgs: eco.id === 'jvm' ? ['-version'] : ['--version'],
      minimum: min,
      severity: 'required',
      fix: runtime.install.replace('{v}', min ?? 'latest'),
    });

    const managerBin = { pnpm: 'pnpm', yarn: 'yarn', bun: 'bun', poetry: 'poetry', uv: 'uv', pipenv: 'pipenv', bundler: 'bundle' }[eco.manager];
    if (managerBin && !(eco.id === 'jvm' && eco.wrapper)) {
      checks.push({
        id: `manager-${eco.manager}`,
        kind: 'command',
        label: `${eco.manager} installed`,
        bin: managerBin,
        severity: 'required',
        fix: MANAGER_FIX[eco.manager] ?? `Install ${eco.manager}`,
        why: eco.lockfile ? `${eco.lockfile} is committed — another package manager will build a broken tree` : null,
      });
    }
  }

  const requiredVars = facts.env.vars.filter((v) => v.required);
  if (requiredVars.length) {
    checks.push({
      id: 'env-file',
      kind: 'file',
      label: '.env exists',
      path: '.env',
      severity: 'required',
      fix: `cp ${facts.env.file ?? '.env.example'} .env`,
    });

    // Checking every variable turns a doctor into a wall of text. The secrets are
    // the ones with no safe default, so those are the ones worth naming.
    for (const v of requiredVars.filter((v) => v.secret).slice(0, 5)) {
      checks.push({
        id: `env-${v.name}`,
        kind: 'envvar',
        label: `${v.name} set`,
        name: v.name,
        severity: 'required',
        fix: `Set ${v.name} in .env (read at ${v.sources[0]})`,
      });
    }
  }

  if (facts.compose) {
    checks.push({
      id: 'docker',
      kind: 'daemon',
      label: 'Docker running',
      bin: 'docker',
      daemonArgs: ['info'],
      severity: facts.services.length ? 'required' : 'optional',
      fix: 'Start Docker Desktop',
      why: facts.services.length
        ? `${facts.services.map((s) => s.kind).join(', ')} run as compose services`
        : null,
    });
  }

  const appPorts = facts.ports.filter((p) => !facts.services.some((s) => s.ports.includes(p)));
  for (const port of appPorts.slice(0, 2)) {
    checks.push({
      id: `port-${port}`,
      kind: 'port',
      label: `port ${port} free`,
      port,
      severity: 'optional',
      // Per-shell hints: the generated .sh and .ps1 must each carry the fix that
      // works where they run, not the one that fits the generating machine.
      fixSh: `lsof -ti:${port} | xargs kill`,
      fixPs: `Get-NetTCPConnection -LocalPort ${port} | ForEach-Object { Stop-Process -Id $_.OwningProcess }`,
      fix: process.platform === 'win32'
        ? `Get-NetTCPConnection -LocalPort ${port} | ForEach-Object { Stop-Process -Id $_.OwningProcess }`
        : `lsof -ti:${port} | xargs kill`,
    });
  }

  return checks;
}

/** Run one check. Returns { ...check, pass, detail }. */
export async function runCheck(check, root) {
  switch (check.kind) {
    case 'version': {
      const raw = commandVersion(check.bin, check.versionArgs);
      if (!raw) return { ...check, pass: false, detail: 'not installed' };
      if (!check.minimum) return { ...check, pass: true, detail: raw };
      const pass = versionAtLeast(raw, check.minimum);
      return { ...check, pass, detail: raw };
    }
    case 'command': {
      const raw = commandVersion(check.bin);
      return { ...check, pass: Boolean(raw), detail: raw ?? 'not installed' };
    }
    case 'daemon': {
      const ok = tryExec(check.bin, check.daemonArgs, { capture: false });
      return { ...check, pass: ok !== null, detail: ok !== null ? 'running' : 'not running' };
    }
    case 'file':
      return { ...check, pass: existsSync(join(root, check.path)), detail: check.path };
    case 'envvar': {
      if (process.env[check.name]) return { ...check, pass: true, detail: 'set in shell' };
      const envPath = join(root, '.env');
      if (!existsSync(envPath)) return { ...check, pass: false, detail: 'no .env' };
      let text = '';
      try {
        text = readFileSync(envPath, 'utf8');
      } catch {
        return { ...check, pass: false, detail: 'unreadable .env' };
      }
      const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${check.name}=`));
      const value = line?.slice(line.indexOf('=') + 1).trim() ?? '';
      return { ...check, pass: value.length > 0, detail: value ? 'set' : 'empty' };
    }
    case 'port': {
      const busy = await portInUse(check.port);
      return { ...check, pass: !busy, detail: busy ? 'in use' : 'free' };
    }
    default:
      return { ...check, pass: true, detail: 'skipped' };
  }
}

export async function runChecks(checks, root) {
  const results = [];
  for (const check of checks) results.push(await runCheck(check, root));
  return results;
}
