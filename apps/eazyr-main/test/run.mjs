// Tests for the detection engine and generators. Run: npm test
//
// Each test builds a throwaway repo on disk, because the thing worth testing is
// whether eazyr reads real files correctly — mocking the filesystem would only
// test the mock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { scan, setupSteps } from '../src/scan.mjs';
import { versionAtLeast, minimumOf, deriveChecks } from '../src/checks.mjs';
import { renderQuickstart, renderEnvExample, renderDoctor } from '../src/generate.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'eazyr.mjs');
const temps = [];

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'eazyr-test-'));
  temps.push(dir);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return dir;
}

process.on('exit', () => {
  for (const dir of temps) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

const NODE_APP = {
  'package.json': JSON.stringify({
    name: 'orders-api',
    engines: { node: '>=20.11' },
    scripts: { dev: 'tsx watch src/server.ts', test: 'vitest run', 'db:migrate': 'prisma migrate deploy' },
  }),
  'pnpm-lock.yaml': '',
  'src/server.ts': `
const port = process.env.PORT || 3000;
const db = process.env.DATABASE_URL;
const key = process.env.STRIPE_SECRET_KEY;
const redis = process.env.REDIS_URL ?? 'redis://localhost:6379';
app.get('/health', handler);
`,
  'docker-compose.yml': `
services:
  db:
    image: postgres:16
    ports:
      - "5432:5432"
  cache:
    image: redis:7
    ports:
      - "6379:6379"
`,
};

// --- version comparison ----------------------------------------------------

test('versionAtLeast compares numerically, not lexically', () => {
  assert.equal(versionAtLeast('10.0.0', '9.0.0'), true, '10 > 9');
  assert.equal(versionAtLeast('9.0.0', '10.0.0'), false, '9 < 10');
  assert.equal(versionAtLeast('20.0.0', '20.0.0'), true, 'equal passes');
  assert.equal(versionAtLeast('20', '20.1'), false, 'missing segments are zero');
  assert.equal(versionAtLeast('20.1', '20'), true);
});

test('versionAtLeast tolerates real-world version output', () => {
  assert.equal(versionAtLeast('v22.11.0', '20'), true, 'leading v');
  assert.equal(versionAtLeast('20.1.0-rc.1', '20.0.0'), true, 'prerelease suffix');
  assert.equal(versionAtLeast('go version go1.22.3 windows/amd64', '1.21'), true, 'version embedded in a banner');
  assert.equal(versionAtLeast('openjdk 17.0.9 2023-10-17', '17'), true);
  assert.equal(versionAtLeast('', '1'), false, 'empty input never passes');
  assert.equal(versionAtLeast(null, '1'), false);
});

test('minimumOf extracts the floor of a range', () => {
  assert.equal(minimumOf('>=20.11'), '20.11.0');
  assert.equal(minimumOf('^3.11'), '3.11.0');
  assert.equal(minimumOf('20.x'), '20.0.0');
  assert.equal(minimumOf('~> 3.2.1'), '3.2.1');
  assert.equal(minimumOf(null), null);
});

// --- detection -------------------------------------------------------------

test('detects the package manager from the lockfile, not the default', () => {
  const facts = scan(repo(NODE_APP));
  assert.equal(facts.ecosystems[0].manager, 'pnpm');
  assert.equal(facts.ecosystems[0].install, 'pnpm install');
  assert.equal(facts.ecosystems[0].versions.node, '>=20.11');
});

test('classifies env vars by whether the code supplies a default', () => {
  const facts = scan(repo(NODE_APP));
  const byName = Object.fromEntries(facts.env.vars.map((v) => [v.name, v]));

  assert.equal(byName.DATABASE_URL.required, true, 'no fallback in source');
  assert.equal(byName.STRIPE_SECRET_KEY.required, true);
  assert.equal(byName.PORT.required, false, '|| 3000 is a default');
  assert.equal(byName.REDIS_URL.required, false, '?? is a default');
  assert.equal(byName.STRIPE_SECRET_KEY.secret, true, 'name implies a secret');
  assert.equal(byName.PORT.secret, false);
});

test('every env var carries file:line provenance', () => {
  const facts = scan(repo(NODE_APP));
  for (const v of facts.env.vars) {
    assert.match(v.sources[0], /^src\/server\.ts:\d+$/, `${v.name} cites its source`);
  }
});

test('variables and routes in test files do not become requirements', () => {
  const facts = scan(repo({
    ...NODE_APP,
    'test/api.test.ts': `
const fixtureKey = process.env.FIXTURE_ONLY_TOKEN;
const shared = process.env.DATABASE_URL;
app.get('/healthz', stub);
`,
  }));
  const byName = Object.fromEntries(facts.env.vars.map((v) => [v.name, v]));

  assert.equal(byName.FIXTURE_ONLY_TOKEN.testOnly, true);
  assert.equal(byName.FIXTURE_ONLY_TOKEN.required, false, 'test-only vars never block a first run');
  assert.equal(byName.DATABASE_URL.testOnly, false, 'also used in app source');
  assert.equal(byName.DATABASE_URL.required, true);

  assert.equal(facts.verify.source, 'src/server.ts', 'health route comes from app source');

  const checkIds = deriveChecks(facts).map((c) => c.id);
  assert.ok(!checkIds.includes('env-FIXTURE_ONLY_TOKEN'), 'no doctor check for a fixture var');
});

test('reads compose services and their ports', () => {
  const facts = scan(repo(NODE_APP));
  assert.deepEqual(facts.services.map((s) => s.kind).sort(), ['postgres', 'redis']);
  assert.deepEqual(facts.services.find((s) => s.kind === 'postgres').ports, [5432]);
});

test('prefers a health endpoint on the app port, not a service port', () => {
  const facts = scan(repo(NODE_APP));
  assert.equal(facts.verify.kind, 'http');
  assert.equal(facts.verify.url, 'http://localhost:3000/health');
});

test('flags drift between .env.example and the source', () => {
  const facts = scan(repo({
    ...NODE_APP,
    '.env.example': 'DATABASE_URL=\nOLD_UNUSED_FLAG=1\n',
  }));
  assert.ok(facts.env.undocumented.includes('STRIPE_SECRET_KEY'), 'undocumented var reported');
  assert.ok(facts.env.stale.includes('OLD_UNUSED_FLAG'), 'stale var reported');
  assert.ok(facts.gaps.some((g) => g.id === 'env-drift'));
});

test('setup steps are ordered and each cites a source file', () => {
  const steps = setupSteps(scan(repo(NODE_APP)));
  const ids = steps.map((s) => s.id);
  assert.deepEqual(ids, ['clone', 'install', 'configure', 'services', 'migrate', 'run', 'verify']);
  assert.ok(ids.indexOf('configure') < ids.indexOf('run'), 'configure before run');
  assert.equal(steps.find((s) => s.id === 'install').source, 'pnpm-lock.yaml');
});

test('detects a Python project and its tooling', () => {
  const facts = scan(repo({
    'pyproject.toml': '[tool.poetry]\nname = "svc"\n[tool.poetry.dependencies]\npython = "^3.11"\n',
    'manage.py': 'import django',
    'app/settings.py': 'SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]\n',
  }));
  const eco = facts.ecosystems[0];
  assert.equal(eco.id, 'python');
  assert.equal(eco.manager, 'poetry');
  assert.equal(eco.install, 'poetry install');
  assert.equal(eco.commands.migrate, 'python manage.py migrate');
  assert.ok(facts.env.vars.some((v) => v.name === 'DJANGO_SECRET_KEY'));
});

test('gap messages never reference a file that does not exist', () => {
  for (const files of [{ 'notes.md': 'x' }, NODE_APP, { ...NODE_APP, '.env.example': 'PORT=3000\n' }]) {
    for (const gap of scan(repo(files)).gaps) {
      assert.ok(!/\bnull\b|\bundefined\b/.test(gap.message), `bad gap message: ${gap.message}`);
    }
  }
});

test('a project with no required config is not told to create a .env', () => {
  const facts = scan(repo({
    'package.json': JSON.stringify({ name: 'lib', scripts: { test: 'node test.js' } }),
    'src/index.js': "const level = process.env.LOG_LEVEL || 'info';\n",
  }));
  assert.ok(!setupSteps(facts).some((s) => s.id === 'configure'), 'no configure step');
  assert.ok(!facts.gaps.some((g) => g.id === 'env-example'), 'no missing-.env.example gap');
});

test('env vars named in comments are not treated as uses', () => {
  const facts = scan(repo({
    'package.json': '{"name":"c"}',
    'src/a.js': "// process.env.DOCUMENTED_IN_A_COMMENT is explained here\nconst real = process.env.ACTUALLY_USED;\n",
  }));
  const names = facts.env.vars.map((v) => v.name);
  assert.deepEqual(names, ['ACTUALLY_USED']);
});

test('an unrecognisable repo reports the gap instead of inventing a stack', () => {
  const facts = scan(repo({ 'notes.md': 'hello' }));
  assert.deepEqual(facts.ecosystems, []);
  assert.ok(facts.gaps.some((g) => g.id === 'stack'));
});

// --- generation ------------------------------------------------------------

test('derived checks cover runtime, manager, env, services and ports', () => {
  const checks = deriveChecks(scan(repo(NODE_APP)));
  const ids = checks.map((c) => c.id);
  assert.ok(ids.includes('runtime-node'));
  assert.ok(ids.includes('env-file'));
  assert.ok(ids.includes('env-STRIPE_SECRET_KEY'), 'required secrets get their own check');
  assert.ok(ids.includes('docker'));
  assert.ok(!ids.includes('port-5432'), 'service ports are expected to be occupied');
  assert.ok(checks.every((c) => c.fix), 'every check offers a fix hint');
});

test('generated doctor scripts get shell-appropriate fix hints', () => {
  const { sh, ps1 } = renderDoctor(scan(repo(NODE_APP)));
  assert.match(sh, /lsof -ti:3000/, 'sh gets the POSIX hint');
  assert.ok(!sh.includes('Get-NetTCPConnection'), 'sh has no PowerShell hint');
  assert.match(ps1, /Get-NetTCPConnection/, 'ps1 gets the Windows hint');
});

test('generated doctor.sh is valid shell', { skip: process.platform === 'win32' && !process.env.MSYSTEM }, () => {
  const dir = repo(NODE_APP);
  const { sh } = renderDoctor(scan(dir));
  writeFileSync(join(dir, 'doctor.sh'), sh);
  execFileSync('bash', ['-n', join(dir, 'doctor.sh')], { stdio: 'ignore' });
});

test('quickstart only contains commands that exist in the project', () => {
  const md = renderQuickstart(scan(repo(NODE_APP)));
  assert.match(md, /pnpm install/);
  assert.match(md, /docker compose up -d/);
  assert.match(md, /curl http:\/\/localhost:3000\/health/);
  assert.ok(!/(^|[^p])npm install/.test(md), 'no manager the repo does not use');
  assert.ok(!/yarn|cargo|poetry/.test(md));
});

test('quickstart marks unknowns as TODO rather than guessing', () => {
  const md = renderQuickstart(scan(repo({ 'notes.md': 'hello' })));
  assert.match(md, /TODO/, 'absent facts surface as TODOs');
  assert.ok(!/pnpm|npm run|cargo/.test(md), 'no invented commands');
});

test('.env.example documents every variable and leaves secrets empty', () => {
  const env = renderEnvExample(scan(repo(NODE_APP)));
  for (const name of ['PORT', 'DATABASE_URL', 'STRIPE_SECRET_KEY', 'REDIS_URL']) {
    assert.ok(env.includes(`${name}=`), `${name} is documented`);
  }
  assert.match(env, /STRIPE_SECRET_KEY=\s*$/m, 'secret has no value');
  assert.match(env, /DATABASE_URL=postgresql:\/\/.*:5432/, 'default matches the compose service');
  assert.match(env, /# Read at src\/server\.ts:\d+/, 'provenance is preserved');
});

// --- CLI -------------------------------------------------------------------

test('scan --json emits parseable facts', () => {
  const out = execFileSync(process.execPath, [CLI, 'scan', '--json', '--cwd', repo(NODE_APP)], {
    encoding: 'utf8',
  });
  const facts = JSON.parse(out);
  assert.equal(facts.name, 'orders-api');
  assert.ok(Array.isArray(facts.steps));
  assert.ok(facts.env.vars.length >= 4);
});

test('init --dry-run reports files without writing them', () => {
  const dir = repo(NODE_APP);
  const out = execFileSync(process.execPath, [CLI, 'init', '--dry-run', '--json', '--cwd', dir], {
    encoding: 'utf8',
  });
  const result = JSON.parse(out);
  assert.deepEqual(result.written.sort(), ['.env.example', 'QUICKSTART.md', 'scripts/doctor.ps1', 'scripts/doctor.sh']);
  assert.throws(() => execFileSync(process.execPath, ['-e', `require('fs').statSync(${JSON.stringify(join(dir, 'QUICKSTART.md'))})`]));
});

test('init does not overwrite existing files without --force', () => {
  const dir = repo({ ...NODE_APP, 'QUICKSTART.md': 'hand-written, do not clobber' });
  const out = execFileSync(process.execPath, [CLI, 'init', '--json', '--cwd', dir], { encoding: 'utf8' });
  const result = JSON.parse(out);
  assert.ok(result.skipped.includes('QUICKSTART.md'));
  assert.ok(!result.written.includes('QUICKSTART.md'));
});
