// The detection engine. Produces a facts object; every fact carries the file it
// came from, so a consumer can cite provenance instead of guessing.

import { basename } from 'node:path';
import { walkSources, read, readJson, has, firstOf } from './walk.mjs';

// ---------------------------------------------------------------------------
// Ecosystems
// ---------------------------------------------------------------------------

function detectNode(root) {
  const pkg = readJson(root, 'package.json');
  if (!pkg) return null;

  // The lockfile is authoritative: using the wrong manager corrupts the tree.
  const lock = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['bun.lockb', 'bun'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ].find(([file]) => has(root, file));

  const declared = typeof pkg.packageManager === 'string'
    ? pkg.packageManager.split('@')[0]
    : null;
  const manager = lock?.[1] ?? declared ?? 'npm';
  const run = manager === 'npm' ? 'npm run' : manager;

  const scripts = pkg.scripts ?? {};
  const pick = (...names) => names.find((n) => scripts[n]);

  const nodeRange = pkg.engines?.node ?? read(root, '.nvmrc')?.trim() ?? null;

  return {
    id: 'node',
    label: 'Node.js',
    manifest: 'package.json',
    manager,
    lockfile: lock?.[0] ?? null,
    versions: nodeRange ? { node: nodeRange } : {},
    install: manager === 'npm' ? 'npm install' : `${manager} install`,
    scripts,
    commands: {
      dev: pick('dev', 'start:dev', 'serve', 'start') && `${run} ${pick('dev', 'start:dev', 'serve', 'start')}`,
      build: pick('build') && `${run} build`,
      test: pick('test') && `${run} test`,
      lint: pick('lint') && `${run} lint`,
      migrate: pick('db:migrate', 'migrate', 'prisma:migrate') && `${run} ${pick('db:migrate', 'migrate', 'prisma:migrate')}`,
    },
    workspaces: Boolean(
      pkg.workspaces || has(root, 'pnpm-workspace.yaml') || has(root, 'turbo.json') || has(root, 'nx.json'),
    ),
  };
}

function detectPython(root) {
  const pyproject = read(root, 'pyproject.toml');
  const requirements = firstOf(root, ['requirements.txt', 'requirements/dev.txt']);
  if (!pyproject && !requirements && !has(root, 'Pipfile')) return null;

  let manager = 'pip';
  if (pyproject?.includes('[tool.poetry]')) manager = 'poetry';
  else if (has(root, 'uv.lock') || pyproject?.includes('[tool.uv]')) manager = 'uv';
  else if (pyproject?.includes('[tool.hatch')) manager = 'hatch';
  else if (has(root, 'Pipfile')) manager = 'pipenv';

  const install = {
    poetry: 'poetry install',
    uv: 'uv sync',
    hatch: 'hatch env create',
    pipenv: 'pipenv install --dev',
    pip: requirements ? `pip install -r ${requirements}` : 'pip install -e .',
  }[manager];

  const versionMatch = pyproject?.match(/requires-python\s*=\s*["']([^"']+)["']/)
    ?? pyproject?.match(/python\s*=\s*["']([^"']+)["']/);

  const django = has(root, 'manage.py');

  return {
    id: 'python',
    label: 'Python',
    manifest: pyproject ? 'pyproject.toml' : requirements ?? 'Pipfile',
    manager,
    lockfile: firstOf(root, ['poetry.lock', 'uv.lock', 'Pipfile.lock']),
    versions: versionMatch ? { python: versionMatch[1] } : {},
    install,
    commands: {
      dev: django ? 'python manage.py runserver' : null,
      test: pyproject?.includes('pytest') ? 'pytest' : null,
      migrate: django ? 'python manage.py migrate' : (has(root, 'alembic.ini') ? 'alembic upgrade head' : null),
    },
    framework: django ? 'django' : null,
  };
}

function detectGo(root) {
  const mod = read(root, 'go.mod');
  if (!mod) return null;
  const version = mod.match(/^go\s+([\d.]+)/m)?.[1] ?? null;
  const module = mod.match(/^module\s+(\S+)/m)?.[1] ?? null;
  return {
    id: 'go',
    label: 'Go',
    manifest: 'go.mod',
    manager: 'go',
    versions: version ? { go: version } : {},
    install: 'go mod download',
    module,
    commands: { dev: 'go run ./...', test: 'go test ./...', build: 'go build ./...' },
  };
}

function detectRust(root) {
  const cargo = read(root, 'Cargo.toml');
  if (!cargo) return null;
  const version = cargo.match(/rust-version\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
  return {
    id: 'rust',
    label: 'Rust',
    manifest: 'Cargo.toml',
    manager: 'cargo',
    versions: version ? { rust: version } : {},
    install: 'cargo fetch',
    commands: { dev: 'cargo run', test: 'cargo test', build: 'cargo build --release' },
  };
}

function detectJvm(root) {
  const gradle = firstOf(root, ['build.gradle.kts', 'build.gradle']);
  const maven = has(root, 'pom.xml');
  if (!gradle && !maven) return null;

  const wrapper = has(root, 'gradlew') ? './gradlew' : has(root, 'mvnw') ? './mvnw' : null;
  const tool = gradle ? 'gradle' : 'maven';
  const cmd = wrapper ?? (gradle ? 'gradle' : 'mvn');

  const text = gradle ? read(root, gradle) : read(root, 'pom.xml');
  const version = text?.match(/(?:JavaLanguageVersion\.of\(|<maven\.compiler\.release>|sourceCompatibility\s*=\s*["']?)(\d{1,2})/)?.[1] ?? null;

  return {
    id: 'jvm',
    label: 'Java',
    manifest: gradle ?? 'pom.xml',
    manager: tool,
    versions: version ? { java: version } : {},
    install: gradle ? `${cmd} build -x test` : `${cmd} -DskipTests install`,
    wrapper: Boolean(wrapper),
    commands: {
      dev: gradle ? `${cmd} bootRun` : `${cmd} spring-boot:run`,
      test: `${cmd} test`,
    },
  };
}

function detectRuby(root) {
  if (!has(root, 'Gemfile')) return null;
  const version = read(root, '.ruby-version')?.trim() ?? null;
  const rails = has(root, 'config/application.rb');
  return {
    id: 'ruby',
    label: 'Ruby',
    manifest: 'Gemfile',
    manager: 'bundler',
    lockfile: has(root, 'Gemfile.lock') ? 'Gemfile.lock' : null,
    versions: version ? { ruby: version } : {},
    install: 'bundle install',
    commands: {
      dev: rails ? 'bin/rails server' : null,
      test: rails ? 'bin/rails test' : 'bundle exec rspec',
      migrate: rails ? 'bin/rails db:migrate' : null,
    },
    framework: rails ? 'rails' : null,
  };
}

const ECOSYSTEMS = [detectNode, detectPython, detectGo, detectRust, detectJvm, detectRuby];

// ---------------------------------------------------------------------------
// Task runners, containers, CI
// ---------------------------------------------------------------------------

function detectTaskRunner(root) {
  if (has(root, 'Makefile')) {
    const text = read(root, 'Makefile') ?? '';
    const targets = [...text.matchAll(/^([a-zA-Z][\w-]*):(?!=)/gm)].map((m) => m[1]);
    return { file: 'Makefile', command: 'make', targets: [...new Set(targets)].slice(0, 20) };
  }
  const just = firstOf(root, ['Justfile', 'justfile']);
  if (just) {
    const text = read(root, just) ?? '';
    const targets = [...text.matchAll(/^([a-zA-Z][\w-]*)(?:\s+\w+)*:/gm)].map((m) => m[1]);
    return { file: just, command: 'just', targets: [...new Set(targets)].slice(0, 20) };
  }
  if (has(root, 'Taskfile.yml')) return { file: 'Taskfile.yml', command: 'task', targets: [] };
  return null;
}

// Recognisable images → the service they provide and its conventional port.
const SERVICE_IMAGES = [
  [/postgres|pgvector|timescale/i, 'postgres', 5432],
  [/mysql|mariadb/i, 'mysql', 3306],
  [/redis|valkey/i, 'redis', 6379],
  [/mongo/i, 'mongodb', 27017],
  [/rabbitmq/i, 'rabbitmq', 5672],
  [/kafka|redpanda/i, 'kafka', 9092],
  [/elasticsearch|opensearch/i, 'elasticsearch', 9200],
  [/minio/i, 'minio', 9000],
  [/clickhouse/i, 'clickhouse', 8123],
];

/**
 * Minimal compose reader. Not a YAML parser — it tracks indentation to find
 * service names and their image/ports, which is all the kit needs.
 */
function detectCompose(root) {
  const file = firstOf(root, [
    'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
  ]);
  if (!file) return null;

  const lines = (read(root, file) ?? '').split(/\r?\n/);
  const services = [];
  let inServices = false;
  let current = null;
  let listKey = null;

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();

    if (indent === 0) {
      inServices = line.startsWith('services:');
      current = null;
      continue;
    }
    if (!inServices) continue;

    const nameMatch = indent <= 2 && line.match(/^([\w.-]+):\s*$/);
    if (nameMatch) {
      current = { name: nameMatch[1], image: null, ports: [], kind: null };
      services.push(current);
      listKey = null;
      continue;
    }
    if (!current) continue;

    const image = line.match(/^image:\s*["']?([^"'\s]+)/);
    if (image) {
      current.image = image[1];
      const known = SERVICE_IMAGES.find(([re]) => re.test(image[1]));
      if (known) current.kind = known[1];
      continue;
    }

    if (/^ports:/.test(line)) { listKey = 'ports'; continue; }
    if (/^[\w.-]+:/.test(line)) { listKey = null; continue; }

    if (listKey === 'ports' && line.startsWith('-')) {
      const value = line.replace(/^-\s*/, '').replace(/["']/g, '');
      const host = value.split(':')[0];
      if (/^\d+$/.test(host)) current.ports.push(Number(host));
    }
  }

  return { file, services };
}

function detectCi(root) {
  const dir = '.github/workflows';
  if (!has(root, dir)) return [];
  const { files } = walkSources(root, { maxFiles: 400 });
  return files
    .filter((f) => f.startsWith(dir) && /\.ya?ml$/.test(f))
    .slice(0, 5)
    .map((file) => {
      const text = read(root, file) ?? '';
      const runs = [...text.matchAll(/^\s*(?:-\s*)?run:\s*(?:\|)?\s*(.*)$/gm)]
        .map((m) => m[1].trim())
        .filter(Boolean)
        .slice(0, 12);
      return { file, commands: runs };
    });
}

// ---------------------------------------------------------------------------
// Environment variables
// ---------------------------------------------------------------------------

const ENV_PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
  /os\.environ(?:\.get)?[[(]\s*["']([A-Z][A-Z0-9_]*)["']/g,
  /os\.getenv\(\s*["']([A-Z][A-Z0-9_]*)["']/g,
  /ENV\[["']([A-Z][A-Z0-9_]*)["']\]/g,
  /os\.Getenv\(\s*["']([A-Z][A-Z0-9_]*)["']\)/g,
  /System\.getenv\(\s*["']([A-Z][A-Z0-9_]*)["']\)/g,
  /getenv\(["']([A-Z][A-Z0-9_]*)["']\)/g,
];

const SECRET_HINT = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|DSN|SALT|CERT|AUTH)/;

// Supplied by the terminal or CI, never by the reader's .env.
const NOISE = new Set([
  'NODE_ENV', 'CI', 'PATH', 'HOME', 'PWD', 'USER', 'SHELL', 'TERM', 'TZ', 'LANG',
  'NO_COLOR', 'FORCE_COLOR', 'TERM_PROGRAM', 'WT_SESSION', 'MSYSTEM', 'COLUMNS', 'DEBUG',
]);

/**
 * Test files describe how the project is exercised, not how it is run. Variables
 * and routes that appear only there would otherwise become fake requirements —
 * a fixture string is not a health endpoint.
 */
export function isTestFile(path) {
  return /(^|\/)(tests?|__tests__|spec|e2e|fixtures?|examples?|mocks?)\//i.test(path)
    || /\.(test|spec)\.[\w]+$/i.test(path);
}

function detectEnvVars(root, files) {
  const found = new Map();

  const record = (name, file, lineNo, hasDefault) => {
    if (!found.has(name)) {
      found.set(name, {
        name, sources: [], hasDefault: false, testOnly: true, secret: SECRET_HINT.test(name),
      });
    }
    const entry = found.get(name);
    if (hasDefault) entry.hasDefault = true;
    if (!isTestFile(file)) entry.testOnly = false;
    // Prefer an app-source citation over a test one, even if the test came first.
    if (entry.sources.length < 3) entry.sources.push(`${file}:${lineNo}`);
  };

  for (const file of files) {
    if (/^\.env/.test(basename(file))) continue; // handled separately
    const text = read(root, file);
    if (!text) continue;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 600) continue;
      // Documentation about an env var is not a use of one.
      if (/^\s*(\/\/|#|\*|<!--)/.test(line)) continue;
      for (const pattern of ENV_PATTERNS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(line)) !== null) {
          const name = m[1];
          if (NOISE.has(name)) continue;
          // `process.env.X || 'y'`, `os.getenv("X", "y")` → the code has a fallback.
          const after = line.slice(m.index + m[0].length, m.index + m[0].length + 40);
          const hasDefault = /^\s*(\|\||\?\?|,\s*["'])/.test(after) || /\.get\([^)]*,/.test(m[0]);
          record(name, file, i + 1, hasDefault);
        }
      }
    }
  }

  // Anything already in .env.example counts as known, even if unreferenced in source.
  const exampleFile = firstOf(root, ['.env.example', '.env.sample', '.env.template']);
  const documented = new Set();
  if (exampleFile) {
    for (const line of (read(root, exampleFile) ?? '').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) documented.add(m[1]);
    }
  }

  const vars = [...found.values()]
    .map((v) => ({
      name: v.name,
      // Test-only vars stay listed — they're real — but never block a first run.
      required: !v.hasDefault && !v.testOnly,
      secret: v.secret,
      testOnly: v.testOnly,
      documented: documented.has(v.name),
      sources: v.sources.sort((a, b) => Number(isTestFile(a)) - Number(isTestFile(b))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    file: exampleFile,
    vars,
    // Drift that matters: variables the app itself reads. A fixture-only var
    // missing from .env.example is not a problem anyone needs to fix.
    undocumented: vars.filter((v) => !v.documented && !v.testOnly).map((v) => v.name),
    stale: [...documented].filter((d) => !found.has(d)),
  };
}

// ---------------------------------------------------------------------------
// Ports and verification
// ---------------------------------------------------------------------------

function detectPorts(root, files, compose) {
  const ports = new Set();

  for (const service of compose?.services ?? []) {
    for (const p of service.ports) ports.add(p);
  }

  for (const file of files.slice(0, 400)) {
    if (isTestFile(file)) continue;
    const text = read(root, file);
    if (!text) continue;
    for (const m of text.matchAll(/PORT[^\n]{0,24}?\|\|\s*["']?(\d{4,5})/g)) ports.add(Number(m[1]));
    for (const m of text.matchAll(/\.listen\(\s*(?:process\.env\.PORT\s*\|\|\s*)?(\d{4,5})/g)) ports.add(Number(m[1]));
    for (const m of text.matchAll(/--port[= ](\d{4,5})/g)) ports.add(Number(m[1]));
  }

  return [...ports].filter((p) => p > 79 && p < 65536).sort((a, b) => a - b);
}

const DEFAULT_PORTS = { node: 3000, python: 8000, go: 8080, jvm: 8080, ruby: 3000, rust: 8080 };

function detectVerify(root, files, ecosystems, ports, compose) {
  // A health endpoint is the best signal: observable, and it proves the app booted.
  for (const file of files.slice(0, 400)) {
    if (isTestFile(file)) continue;
    const text = read(root, file);
    if (!text) continue;
    const route = text.match(/["'](\/(?:health[a-z]*|healthcheck|api\/health|_health|status|ping))["']/i);
    if (route) {
      const appPort = ports.find((p) => !isServicePort(p, compose)) ?? ports[0]
        ?? DEFAULT_PORTS[ecosystems[0]?.id] ?? 3000;
      return { kind: 'http', url: `http://localhost:${appPort}${route[1]}`, source: file };
    }
  }

  const test = ecosystems.find((e) => e.commands?.test)?.commands.test;
  if (test) return { kind: 'command', command: test, source: ecosystems[0].manifest };

  const port = ports[0] ?? DEFAULT_PORTS[ecosystems[0]?.id];
  return port ? { kind: 'http', url: `http://localhost:${port}`, source: 'inferred' } : null;
}

function isServicePort(port, compose) {
  return (compose?.services ?? []).some((s) => s.kind && s.ports.includes(port));
}

// ---------------------------------------------------------------------------
// Gaps — what the onboarding kit should add
// ---------------------------------------------------------------------------

function findGaps(root, facts) {
  const gaps = [];

  if (!facts.docs.quickstart) {
    gaps.push({ id: 'quickstart', severity: 'high', message: 'No QUICKSTART.md — setup steps are undocumented or buried in the README.' });
  }
  if (!facts.docs.doctor) {
    gaps.push({ id: 'doctor', severity: 'medium', message: 'No prerequisite check — newcomers discover a missing tool halfway through setup.' });
  }
  const requiredVars = facts.env.vars.filter((v) => v.required);
  if (requiredVars.length && !facts.env.file) {
    gaps.push({ id: 'env-example', severity: 'high', message: `${requiredVars.length} required environment variable(s) read by the code, but no .env.example exists.` });
  } else if (facts.env.file && facts.env.undocumented.length) {
    gaps.push({ id: 'env-drift', severity: 'high', message: `Undocumented in ${facts.env.file}: ${facts.env.undocumented.slice(0, 6).join(', ')}${facts.env.undocumented.length > 6 ? '…' : ''}` });
  }
  if (facts.env.stale.length) {
    gaps.push({ id: 'env-stale', severity: 'low', message: `Declared in ${facts.env.file} but unused in source: ${facts.env.stale.slice(0, 6).join(', ')}` });
  }
  if (!facts.ecosystems.length) {
    gaps.push({ id: 'stack', severity: 'high', message: 'No recognised manifest. The install and run steps will need to come from a human.' });
  }
  if (facts.services.length && !facts.compose) {
    gaps.push({ id: 'services', severity: 'medium', message: 'External services are referenced but there is no compose file to start them.' });
  }
  if (!facts.docs.readme) {
    gaps.push({ id: 'readme', severity: 'medium', message: 'No README.md.' });
  }
  if (!facts.docs.license) {
    gaps.push({ id: 'license', severity: 'low', message: 'No LICENSE file — reuse terms are unstated.' });
  }

  return gaps;
}

// ---------------------------------------------------------------------------

export function scan(root = process.cwd()) {
  const { files, truncated } = walkSources(root);

  const ecosystems = ECOSYSTEMS.map((fn) => fn(root)).filter(Boolean);
  const compose = detectCompose(root);
  const ports = detectPorts(root, files, compose);
  const env = detectEnvVars(root, files);

  const services = (compose?.services ?? [])
    .filter((s) => s.kind)
    .map((s) => ({ name: s.name, kind: s.kind, image: s.image, ports: s.ports }));

  const pkg = readJson(root, 'package.json');
  const name = pkg?.name ?? basename(root);

  const facts = {
    name,
    root,
    scannedFiles: files.length,
    truncated,
    ecosystems,
    taskRunner: detectTaskRunner(root),
    compose,
    dockerfile: firstOf(root, ['Dockerfile', 'docker/Dockerfile']),
    devcontainer: has(root, '.devcontainer/devcontainer.json'),
    ci: detectCi(root),
    env,
    ports,
    services,
    docs: {
      readme: Boolean(firstOf(root, ['README.md', 'readme.md', 'README.rst'])),
      quickstart: Boolean(firstOf(root, ['QUICKSTART.md', 'docs/QUICKSTART.md', 'GETTING_STARTED.md'])),
      contributing: has(root, 'CONTRIBUTING.md'),
      license: Boolean(firstOf(root, ['LICENSE', 'LICENSE.md', 'LICENSE.txt'])),
      doctor: Boolean(firstOf(root, ['scripts/doctor.sh', 'scripts/doctor.ps1', 'bin/doctor'])),
    },
  };

  facts.verify = detectVerify(root, files, ecosystems, ports, compose);
  facts.gaps = findGaps(root, facts);

  return facts;
}

/** The ordered steps a newcomer must perform. Every step cites its source file. */
export function setupSteps(facts) {
  const steps = [];
  const primary = facts.ecosystems[0];

  steps.push({ id: 'clone', title: 'Clone the repository', command: null, source: null });

  if (primary) {
    steps.push({
      id: 'install',
      title: 'Install dependencies',
      command: primary.install,
      source: primary.lockfile ?? primary.manifest,
    });
  }

  // Only a step if something actually has to be set. A project with no required
  // configuration should not be told to copy an .env it doesn't need.
  const required = facts.env.vars.filter((v) => v.required);
  if (required.length || facts.env.file) {
    steps.push({
      id: 'configure',
      title: 'Configure environment',
      command: facts.env.file ? `cp ${facts.env.file} .env` : 'cp .env.example .env',
      source: facts.env.file ?? 'generated',
      detail: required.filter((v) => v.secret).map((v) => v.name),
    });
  }

  if (facts.compose) {
    steps.push({ id: 'services', title: 'Start services', command: 'docker compose up -d', source: facts.compose.file });
  }

  const migrate = facts.ecosystems.find((e) => e.commands?.migrate)?.commands.migrate;
  if (migrate) {
    steps.push({ id: 'migrate', title: 'Prepare the database', command: migrate, source: primary?.manifest });
  }

  const dev = facts.ecosystems.find((e) => e.commands?.dev)?.commands.dev
    ?? (facts.taskRunner?.targets.includes('dev') ? `${facts.taskRunner.command} dev` : null);
  if (dev) {
    steps.push({ id: 'run', title: 'Run it', command: dev, source: primary?.manifest ?? facts.taskRunner?.file });
  }

  if (facts.verify) {
    steps.push({
      id: 'verify',
      title: 'Verify',
      command: facts.verify.kind === 'http' ? `curl ${facts.verify.url}` : facts.verify.command,
      source: facts.verify.source,
    });
  }

  return steps;
}
