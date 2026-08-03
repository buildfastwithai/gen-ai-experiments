#!/usr/bin/env node
// eazyr — make any repo easy to run.

import { scan, setupSteps } from '../src/scan.mjs';
import { deriveChecks, runChecks } from '../src/checks.mjs';
import { buildKit, writeKit } from '../src/generate.mjs';
import { installSkill, skillVersion, skillTarget } from '../src/install.mjs';
import { c, sym, pad } from '../src/ui.mjs';

const HELP = `
${c.bold('eazyr')} — make any repo easy to run

${c.bold('USAGE')}
  npx eazyr [command] [options]

${c.bold('COMMANDS')}
  scan              Report what the project needs to run          ${c.dim('(default)')}
  doctor            Check this machine against those needs
  init              Write QUICKSTART.md, scripts/doctor.*, .env.example
  skill install     Install the Claude Code skill
  help              Show this

${c.bold('OPTIONS')}
  --json            Machine-readable output ${c.dim('(scan, doctor, init)')}
  --force           Overwrite existing files ${c.dim('(init, skill install)')}
  --dry-run         Show what init would write, without writing
  --project         Install the skill into ./.claude/skills ${c.dim('instead of ~/')}
  --cwd <path>      Operate on another directory
  --version         Print version

${c.bold('EXAMPLES')}
  npx eazyr                       ${c.dim('# what does this repo need?')}
  npx eazyr doctor                ${c.dim('# is my machine ready?')}
  npx eazyr init --dry-run        ${c.dim('# preview the onboarding kit')}
  npx eazyr scan --json           ${c.dim('# facts for a tool or an agent')}
`;

function parseArgs(argv) {
  const opts = { cwd: process.cwd() };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--force' || arg === '-f') opts.force = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--project') opts.project = true;
    else if (arg === '--cwd') opts.cwd = argv[++i];
    else if (arg === '--version' || arg === '-v') opts.version = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('-')) opts.unknown = arg;
    else positional.push(arg);
  }

  return { command: positional.join(' ') || 'scan', opts };
}

const SEVERITY_COLOR = { high: c.red, medium: c.yellow, low: c.dim };

function reportScan(facts) {
  console.log(`\n${c.bold(facts.name)} ${c.dim(`— ${facts.scannedFiles} files scanned`)}\n`);

  if (facts.ecosystems.length) {
    for (const eco of facts.ecosystems) {
      const version = Object.entries(eco.versions)[0];
      console.log(
        `  ${pad(c.cyan(eco.label), 22)}${version ? `${version[0]} ${version[1]}  ` : ''}` +
        c.dim(`via ${eco.manager} · ${eco.manifest}`),
      );
    }
  } else {
    console.log(`  ${c.yellow('No recognised manifest')} ${c.dim('— stack is unknown')}`);
  }
  if (facts.compose) {
    const list = facts.services.map((s) => s.kind).join(', ') || 'no recognised images';
    console.log(`  ${pad(c.cyan('Services'), 22)}${list}  ${c.dim(`· ${facts.compose.file}`)}`);
  }
  if (facts.ports.length) console.log(`  ${pad(c.cyan('Ports'), 22)}${facts.ports.join(', ')}`);
  if (facts.env.vars.length) {
    const required = facts.env.vars.filter((v) => v.required).length;
    console.log(`  ${pad(c.cyan('Env vars'), 22)}${facts.env.vars.length} ${c.dim(`(${required} required)`)}`);
  }

  console.log(`\n${c.bold('Setup path')}`);
  for (const step of setupSteps(facts)) {
    const cmd = step.command ? c.dim(step.command) : c.dim('git clone …');
    console.log(`  ${pad(step.title, 24)}${cmd}`);
    if (step.source) console.log(`  ${' '.repeat(24)}${c.dim(`from ${step.source}`)}`);
  }

  if (facts.gaps.length) {
    console.log(`\n${c.bold('Gaps')}`);
    for (const gap of facts.gaps) {
      const color = SEVERITY_COLOR[gap.severity] ?? c.dim;
      console.log(`  ${color(sym.bullet)} ${gap.message}`);
    }
    console.log(`\n  ${c.dim(`${sym.arrow} npx eazyr init  writes the missing pieces`)}`);
  } else {
    console.log(`\n  ${c.green(sym.ok)} This project is already onboardable.`);
  }
  console.log('');
}

async function commandDoctor(facts, opts) {
  const checks = deriveChecks(facts);

  if (!checks.length) {
    console.log(`\n${c.yellow('Nothing to check')} — no stack, services, or required variables detected.\n`);
    return 0;
  }

  if (!opts.json) console.log(`\nChecking your environment for ${c.bold(facts.name)}...\n`);
  const results = await runChecks(checks, opts.cwd);

  const failed = results.filter((r) => !r.pass && r.severity === 'required');
  const warned = results.filter((r) => !r.pass && r.severity === 'optional');

  if (opts.json) {
    console.log(JSON.stringify({ project: facts.name, results, failed: failed.length }, null, 2));
    return failed.length ? 1 : 0;
  }

  const width = Math.max(...results.map((r) => r.label.length)) + 2;
  for (const r of results) {
    if (r.pass) {
      console.log(`${c.green(sym.ok)}  ${pad(r.label, width)}${c.dim(r.detail ?? '')}`);
    } else if (r.severity === 'optional') {
      console.log(`${c.yellow(sym.warn)}  ${pad(r.label, width)}${c.dim(`${r.detail} (optional)`)}`);
      console.log(c.dim(`   ${sym.arrow} ${r.fix}`));
    } else {
      console.log(`${c.red(sym.fail)}  ${pad(r.label, width)}${c.dim(r.detail ?? '')}`);
      console.log(c.dim(`   ${sym.arrow} ${r.fix}`));
      if (r.why) console.log(c.dim(`     ${r.why}`));
    }
  }

  console.log('');
  if (failed.length) {
    console.log(`${c.red(`${failed.length} required check(s) failed.`)} Fix the items above, then run this again.\n`);
    return 1;
  }
  console.log(warned.length
    ? `${c.green('Ready')} — with ${warned.length} optional item(s) unavailable.\n`
    : `${c.green('Ready.')}\n`);
  return 0;
}

function commandInit(facts, opts) {
  const { files, checks } = buildKit(facts);
  const { written, skipped } = writeKit(opts.cwd, files, { force: opts.force, dryRun: opts.dryRun });

  if (opts.json) {
    console.log(JSON.stringify({ written, skipped, checks: checks.length, dryRun: Boolean(opts.dryRun) }, null, 2));
    return skipped.length && !written.length ? 1 : 0;
  }

  const verb = opts.dryRun ? 'Would write' : 'Wrote';
  console.log('');
  for (const path of written) console.log(`  ${c.green(sym.ok)} ${verb.toLowerCase()} ${c.bold(path)}`);
  for (const path of skipped) console.log(`  ${c.dim(`${sym.warn} skipped ${path} — already exists (--force to overwrite)`)}`);

  if (written.length) {
    console.log(`\n  ${checks.length} prerequisite check(s) derived from your project.`);
    console.log(c.dim(`  ${sym.arrow} Review the TODOs, then commit. The kit is a first draft, not a final answer.`));
  }
  console.log('');
  return 0;
}

function commandSkillInstall(opts) {
  const { target, status } = installSkill(opts);

  if (status === 'exists') {
    console.log(`\n  ${c.yellow(sym.warn)} Already installed at ${c.bold(target)}`);
    console.log(c.dim(`   ${sym.arrow} npx eazyr skill install --force  to update\n`));
    return 0;
  }

  console.log(`\n  ${c.green(sym.ok)} Skill ${status} at ${c.bold(target)}`);
  console.log(c.dim(`\n   Restart Claude Code, then check /skills. Try:`));
  console.log(c.dim(`   "I can't get this project running — figure out the setup and document it"\n`));
  return 0;
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));

  if (opts.version) {
    console.log(skillVersion());
    return 0;
  }
  if (opts.help || command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (opts.unknown) {
    console.error(`${c.red('Unknown option')} ${opts.unknown}\n${c.dim('npx eazyr help')}`);
    return 2;
  }

  if (command === 'skill install' || command === 'install') {
    return commandSkillInstall(opts);
  }
  if (command === 'skill') {
    console.log(`\n  Skill target: ${c.bold(skillTarget(opts))}`);
    console.log(c.dim(`  ${sym.arrow} npx eazyr skill install\n`));
    return 0;
  }

  if (!['scan', 'doctor', 'init'].includes(command)) {
    console.error(`${c.red('Unknown command')} ${command}\n${c.dim('npx eazyr help')}`);
    return 2;
  }

  const facts = scan(opts.cwd);

  if (command === 'scan') {
    if (opts.json) {
      console.log(JSON.stringify({ ...facts, steps: setupSteps(facts) }, null, 2));
      return 0;
    }
    reportScan(facts);
    return 0;
  }
  if (command === 'doctor') return commandDoctor(facts, opts);
  return commandInit(facts, opts);
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    console.error(`${c.red('eazyr failed:')} ${error.message}`);
    if (process.env.EAZYR_DEBUG) console.error(error.stack);
    process.exit(1);
  });
