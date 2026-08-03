// Renders the onboarding kit from scan facts.
//
// Everything written here traces to something detected. Where a fact is missing,
// the output carries a TODO rather than a plausible-looking guess — a wrong step
// costs more than an obviously absent one.

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupSteps } from './scan.mjs';
import { deriveChecks } from './checks.mjs';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const shq = (s) => `"${String(s).replace(/(["$`\\])/g, '\\$1')}"`;
const psq = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// doctor scripts
// ---------------------------------------------------------------------------

function shellTest(check) {
  switch (check.kind) {
    case 'version':
      return check.minimum
        ? `command -v ${check.bin} >/dev/null && version_at_least "$(${check.bin} ${check.versionArgs.join(' ')} 2>&1 | head -n1 | tr -cd '0-9.\\n')" ${check.minimum}`
        : `command -v ${check.bin} >/dev/null`;
    case 'command':
      return `command -v ${check.bin} >/dev/null`;
    case 'daemon':
      return `${check.bin} ${check.daemonArgs.join(' ')} >/dev/null 2>&1`;
    case 'file':
      return `[ -f ${check.path} ]`;
    case 'envvar':
      return `[ -n "\${${check.name}:-}" ] || { [ -f .env ] && grep -qE '^${check.name}=.+' .env; }`;
    case 'port':
      return `! port_in_use ${check.port}`;
    default:
      return 'true';
  }
}

function psTest(check) {
  switch (check.kind) {
    case 'version':
      return check.minimum
        ? `(Test-Command ${check.bin}) -and (Test-VersionAtLeast "$(${check.bin} ${check.versionArgs.join(' ')} 2>&1 | Select-Object -First 1)" '${check.minimum}')`
        : `Test-Command ${check.bin}`;
    case 'command':
      return `Test-Command ${check.bin}`;
    case 'daemon':
      return `(Test-Command ${check.bin}) -and $(${check.bin} ${check.daemonArgs.join(' ')} *>$null; $?)`;
    case 'file':
      return `Test-Path ${psq(check.path)}`;
    case 'envvar':
      return `$env:${check.name} -or ((Test-Path .env) -and ((Get-Content .env) -match '^${check.name}=.+'))`;
    case 'port':
      return `-not (Test-PortInUse ${check.port})`;
    default:
      return '$true';
  }
}

function renderShellChecks(checks) {
  return checks
    .map((check) => {
      const why = check.why ? `  # ${check.why}\n` : '';
      return `${why}  check ${check.severity} ${shq(check.label)} ${shq(check.fixSh ?? check.fix)} <<'TEST'
    ${shellTest(check)}
TEST`;
    })
    .join('\n\n');
}

function renderPsChecks(checks) {
  return checks
    .map((check) => {
      const why = check.why ? `  # ${check.why}\n` : '';
      return `${why}  Check -Severity ${check.severity} -Label ${psq(check.label)} \`
        -Fix ${psq(check.fixPs ?? check.fix)} -Test {
    ${psTest(check)}
  }`;
    })
    .join('\n\n');
}

function fillTemplate(templateName, checksBlock, projectName) {
  const text = readFileSync(join(ASSETS, templateName), 'utf8');
  const start = text.indexOf('# --- CHECKS-START');
  const end = text.indexOf('# --- CHECKS-END');
  if (start === -1 || end === -1) {
    throw new Error(`${templateName} is missing its CHECKS markers`);
  }
  const head = text.slice(0, text.indexOf('\n', start) + 1);
  const tail = text.slice(end);
  return (head + '\n' + checksBlock + '\n\n' + tail).replace(/<PROJECT>/g, projectName);
}

export function renderDoctor(facts) {
  const checks = deriveChecks(facts);
  return {
    checks,
    sh: fillTemplate('doctor.sh', renderShellChecks(checks), facts.name),
    ps1: fillTemplate('doctor.ps1', renderPsChecks(checks), facts.name),
  };
}

// ---------------------------------------------------------------------------
// .env.example
// ---------------------------------------------------------------------------

const KNOWN_DEFAULTS = [
  [/^DATABASE_URL$|^POSTGRES_URL$/, (f) => {
    const svc = f.services.find((s) => s.kind === 'postgres');
    return svc ? `postgresql://postgres:postgres@localhost:${svc.ports[0] ?? 5432}/${f.name.replace(/[^\w]/g, '_')}_dev` : null;
  }],
  [/^REDIS_URL$/, (f) => {
    const svc = f.services.find((s) => s.kind === 'redis');
    return svc ? `redis://localhost:${svc.ports[0] ?? 6379}` : null;
  }],
  [/^MONGO(DB)?_URL$|^MONGO_URI$/, (f) => {
    const svc = f.services.find((s) => s.kind === 'mongodb');
    return svc ? `mongodb://localhost:${svc.ports[0] ?? 27017}/${f.name}` : null;
  }],
  [/^PORT$/, (f) => String(f.ports[0] ?? 3000)],
  [/^NODE_ENV$/, () => 'development'],
  [/^LOG_LEVEL$/, () => 'debug'],
];

function groupOf(name) {
  if (/DATABASE|POSTGRES|MYSQL|MONGO|SQL/.test(name)) return 'Database';
  if (/REDIS|CACHE|MEMCACHE/.test(name)) return 'Cache';
  if (/PORT|HOST|URL|ORIGIN|BASE/.test(name)) return 'Server';
  if (/ENABLE_|FEATURE_|_FLAG/.test(name)) return 'Feature flags';
  if (/KEY|TOKEN|SECRET|PASSWORD|DSN|CREDENTIAL/.test(name)) return 'Secrets and third-party services';
  return 'Application';
}

const GROUP_ORDER = ['Application', 'Server', 'Database', 'Cache', 'Secrets and third-party services', 'Feature flags', 'Other'];

export function renderEnvExample(facts) {
  if (!facts.env.vars.length) return null;

  const groups = new Map();
  for (const v of facts.env.vars) {
    const g = groupOf(v.name);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }

  const out = [
    `# Copy to .env and fill in the blanks:  cp .env.example .env`,
    `#`,
    `# Generated by eazyr from ${facts.env.vars.length} variable(s) read in the source.`,
    `# Empty values are secrets — never commit a filled-in .env.`,
    '',
  ];

  for (const group of [...groups.keys()].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))) {
    const width = Math.max(0, 74 - group.length);
    out.push(`# --- ${group} ${'-'.repeat(width)}`, '');

    for (const v of groups.get(group)) {
      const known = KNOWN_DEFAULTS.find(([re]) => re.test(v.name))?.[1](facts) ?? null;
      out.push(`# Read at ${v.sources[0]}${v.sources.length > 1 ? ` (+${v.sources.length - 1} more)` : ''}`);
      if (v.required) out.push('# REQUIRED.');
      if (v.testOnly) out.push('# Used only by the test suite — not needed to run the app.');
      if (v.secret && !known) out.push('# Secret — obtain from the service dashboard. TODO: name the source.');
      if (!v.required && !known) out.push('# Optional: the code supplies a default.');
      out.push(`${v.name}=${known ?? ''}`, '');
    }
  }

  if (facts.env.stale.length) {
    out.push(`# The previous ${facts.env.file} also declared these, unused in source:`);
    out.push(`# ${facts.env.stale.join(', ')}`, '');
  }

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// QUICKSTART.md
// ---------------------------------------------------------------------------

const fence = (lang, body) => ['```' + lang, body, '```'].join('\n');

export function renderQuickstart(facts) {
  const steps = setupSteps(facts);
  const primary = facts.ecosystems[0];
  const out = [];

  out.push(`# Quickstart`, '');
  out.push(`Get ${facts.name} running locally.`, '');

  // Success criteria first, so the reader knows what "done" looks like.
  out.push('## What success looks like', '');
  if (facts.verify?.kind === 'http') {
    out.push(fence('bash', `curl ${facts.verify.url}`), '');
    out.push(`A `+'`200`'+` response means the app is up.`, '');
  } else if (facts.verify) {
    out.push(fence('bash', facts.verify.command), '');
    out.push('A passing suite means your environment is wired correctly.', '');
  } else {
    out.push('> **TODO:** No health endpoint or test command was detected. Describe how a reader confirms it works.', '');
  }

  out.push('## Prerequisites', '');
  const rows = [];
  for (const eco of facts.ecosystems) {
    const [tool, range] = Object.entries(eco.versions)[0] ?? [eco.label.toLowerCase(), 'any'];
    rows.push([eco.label, range, `\`${tool === 'jvm' ? 'java' : tool} --version\``]);
    if (eco.manager && !['pip', 'go', 'cargo'].includes(eco.manager)) {
      rows.push([eco.manager, 'any', `\`${eco.manager} --version\``]);
    }
  }
  if (facts.compose) rows.push(['Docker', 'any recent', '`docker info`']);

  if (rows.length) {
    out.push('| Tool | Version | Check |', '| --- | --- | --- |');
    for (const [a, b, c] of rows) out.push(`| ${a} | ${b} | ${c} |`);
    out.push('');
  } else {
    out.push('> **TODO:** No manifest was detected — list the required tools here.', '');
  }
  out.push('Or check everything at once:', '');
  out.push(fence('bash', './scripts/doctor.sh'), '');
  out.push(fence('powershell', '.\\scripts\\doctor.ps1'), '');

  out.push('## Setup', '');
  let n = 0;
  for (const step of steps) {
    if (step.id === 'verify') continue;

    if (step.id === 'clone') {
      out.push(`**${++n}. ${step.title}**`, '');
      out.push(fence('bash', `git clone <REPO_URL>\ncd ${facts.name}`), '');
      continue;
    }
    if (step.id === 'run') continue; // has its own section

    out.push(`**${++n}. ${step.title}**`, '');
    out.push(fence('bash', step.command), '');

    if (step.id === 'install' && primary?.lockfile) {
      out.push(`Use ${primary.manager} — \`${primary.lockfile}\` is committed, and another package manager will build a tree that installs but fails at runtime.`, '');
    }
    if (step.id === 'configure') {
      const secrets = step.detail ?? [];
      if (secrets.length) {
        out.push('Then set these in `.env` — they have no safe default:', '');
        for (const name of secrets) out.push(`- \`${name}\``);
        out.push('');
      } else {
        out.push('The defaults work for local development.', '');
      }
    }
    if (step.id === 'services' && facts.services.length) {
      out.push(`This starts ${facts.services.map((s) => `${s.kind} (port ${s.ports[0] ?? '?'})`).join(', ')}. Wait for \`docker compose ps\` to report healthy before the next step.`, '');
    }
  }

  const runStep = steps.find((s) => s.id === 'run');
  out.push('## Run', '');
  if (runStep) {
    out.push(fence('bash', runStep.command), '');
  } else {
    out.push('> **TODO:** No run command was detected. Add the command that starts the app.', '');
  }
  if (facts.verify?.kind === 'http') {
    out.push('Confirm:', '', fence('bash', `curl ${facts.verify.url}`), '');
  }

  const tasks = [];
  for (const eco of facts.ecosystems) {
    for (const [name, cmd] of Object.entries(eco.commands ?? {})) {
      if (cmd && name !== 'dev') tasks.push([name, cmd]);
    }
  }
  if (facts.compose) tasks.push(['reset local data', 'docker compose down -v && docker compose up -d']);
  if (tasks.length) {
    out.push('## Common tasks', '', '| Task | Command |', '| --- | --- |');
    for (const [name, cmd] of tasks) out.push(`| ${name} | \`${cmd}\` |`);
    out.push('');
  }

  out.push('## Troubleshooting', '');
  const appPort = facts.ports.find((p) => !facts.services.some((s) => s.ports.includes(p))) ?? facts.ports[0];
  if (appPort) {
    out.push(`**\`EADDRINUSE\` / "address already in use" on port ${appPort}**`, '');
    out.push(fence('bash', `lsof -ti:${appPort} | xargs kill`), '');
    out.push(fence('powershell', `Get-NetTCPConnection -LocalPort ${appPort} | ForEach-Object { Stop-Process -Id $_.OwningProcess }`), '');
  }
  for (const svc of facts.services.slice(0, 2)) {
    out.push(`**\`ECONNREFUSED 127.0.0.1:${svc.ports[0] ?? '?'}\`**`, '');
    out.push(`The ${svc.kind} service isn't up yet. Run \`docker compose up -d\`, then \`docker compose ps\` — \`${svc.name}\` must read healthy.`, '');
  }
  if (primary?.lockfile) {
    out.push('**Module or import errors immediately after install**', '');
    out.push('The dependency tree was built by a different package manager. Reset it:', '');
    out.push(fence('bash', `rm -rf ${primary.id === 'node' ? 'node_modules' : '.venv'} && ${primary.install}`), '');
  }
  out.push('> Add the failures you actually hit — those are the ones worth documenting.', '');

  const links = [];
  if (facts.docs.readme) links.push('- [README](README.md)');
  if (facts.docs.contributing) links.push('- [Contributing](CONTRIBUTING.md)');
  if (links.length) out.push('## Next steps', '', ...links, '');
  out.push(`<!-- Generated by eazyr from ${facts.scannedFiles} scanned files. Review before committing. -->`);

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export function buildKit(facts) {
  const doctor = renderDoctor(facts);
  const files = [
    { path: 'QUICKSTART.md', content: renderQuickstart(facts) },
    { path: 'scripts/doctor.sh', content: doctor.sh, mode: 0o755 },
    { path: 'scripts/doctor.ps1', content: doctor.ps1 },
  ];
  const env = renderEnvExample(facts);
  if (env) files.push({ path: '.env.example', content: env });
  return { files, checks: doctor.checks };
}

export function writeKit(root, files, { force = false, dryRun = false } = {}) {
  const written = [];
  const skipped = [];

  for (const file of files) {
    const full = join(root, file.path);
    if (existsSync(full) && !force) {
      skipped.push(file.path);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, file.content.endsWith('\n') ? file.content : `${file.content}\n`, 'utf8');
      if (file.mode && process.platform !== 'win32') chmodSync(full, file.mode);
    }
    written.push(file.path);
  }

  return { written, skipped };
}
