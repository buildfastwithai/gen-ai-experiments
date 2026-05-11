#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — CLI Entry Point
// "Crumbles bugs. Occasionally reality too."
// ═══════════════════════════════════════════════════════════════

import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv';
import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { CookieAgent } from '../core/agent.js';
import { startUI } from '../ui/app.js';
import { getPlatformInfo } from '../platform/detect.js';
import { theme } from '../ui/theme.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// Load .env files
dotenvConfig();
dotenvConfig({ path: '.env.local' });

const VERSION = '1.0.0';

const program = new Command();

program
  .name('cookie')
  .description('🍪 Cookie — Crumbles bugs. Occasionally reality too.')
  .version(VERSION);

// ── Main interactive mode ──
program
  .command('chat', { isDefault: true })
  .description('Start interactive chat mode')
  .option('-p, --provider <name>', 'LLM provider to use')
  .option('-m, --model <name>', 'Model to use')
  .option('--no-ui', 'Disable fancy UI (plain text mode)')
  .option('--verbose', 'Enable verbose output')
  .option('--safety <mode>', 'Safety mode: strict, normal, yolo', 'normal')
  .action(async (opts) => {
    const config = loadConfig({
      provider: {
        default: opts.provider || undefined,
        model: opts.model || undefined,
      } as never,
      safety: { mode: opts.safety } as never,
      personality: { verbose: opts.verbose } as never,
    });

    const agent = new CookieAgent({
      config,
      provider: opts.provider,
      model: opts.model,
    });

    await agent.init();

    if (opts.ui === false) {
      // Plain text mode (for piping, CI, etc.)
      await runPlainMode(agent);
    } else {
      startUI(agent);
    }
  });

// ── Single prompt execution ──
program
  .command('run <prompt>')
  .description('Execute a single prompt and exit')
  .option('-p, --provider <name>', 'LLM provider')
  .option('-m, --model <name>', 'Model')
  .action(async (prompt, opts) => {
    const config = loadConfig();
    const agent = new CookieAgent({
      config,
      mode: 'autonomous',
      provider: opts.provider,
      model: opts.model,
    });

    await agent.init();

    agent.onStream = (chunk) => {
      if (chunk.type === 'token' && chunk.content) {
        process.stdout.write(chunk.content);
      }
    };

    agent.onConfirm = async (msg) => {
      console.log(chalk.hex(theme.warning)('\n⚠️ Confirmation needed:'));
      console.log(msg);
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => {
        rl.question(chalk.hex(theme.accent)('Approve? (y/n): '), (answer) => {
          rl.close();
          resolve(answer.toLowerCase().startsWith('y'));
        });
      });
    };

    const response = await agent.chat(prompt);
    if (response && !agent.onStream) {
      console.log(response);
    }
    console.log('');
    await agent.shutdown();
    process.exit(0);
  });

// ── Config command ──
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    const platform = getPlatformInfo();

    console.log(chalk.hex(theme.primary)('\n🍪 Cookie Configuration\n'));
    console.log(chalk.hex(theme.textDim)('Platform:'), chalk.hex(theme.text)(platform.platform));
    console.log(chalk.hex(theme.textDim)('Shell:'), chalk.hex(theme.text)(platform.shell));
    console.log(chalk.hex(theme.textDim)('Arch:'), chalk.hex(theme.text)(platform.arch));
    console.log(chalk.hex(theme.textDim)('Cookie Dir:'), chalk.hex(theme.text)(platform.cookieDir));
    console.log(chalk.hex(theme.textDim)('Provider:'), chalk.hex(theme.text)(config.provider.default));
    console.log(chalk.hex(theme.textDim)('Model:'), chalk.hex(theme.text)(config.provider.model));
    console.log(chalk.hex(theme.textDim)('Safety:'), chalk.hex(theme.text)(config.safety.mode));
    console.log(chalk.hex(theme.textDim)('Humor:'), chalk.hex(theme.text)(config.personality.humor));
    console.log('');

    const available = Object.entries(config.provider.apiKeys)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    console.log(chalk.hex(theme.textDim)('Configured providers:'), chalk.hex(theme.accent)(available.join(', ') || 'none'));
    console.log('');
  });

// ── Providers list ──
program
  .command('providers')
  .description('List available LLM providers')
  .action(() => {
    const config = loadConfig();
    console.log(chalk.hex(theme.primary)('\n🍪 Available Providers\n'));

    const providers = [
      { name: 'openai', display: 'OpenAI', key: config.provider.apiKeys.openai },
      { name: 'anthropic', display: 'Anthropic', key: config.provider.apiKeys.anthropic },
      { name: 'gemini', display: 'Google Gemini', key: config.provider.apiKeys.gemini },
      { name: 'groq', display: 'Groq', key: config.provider.apiKeys.groq },
      { name: 'openrouter', display: 'OpenRouter', key: config.provider.apiKeys.openrouter },
      { name: 'ollama', display: 'Ollama (Local)', key: 'local' },
      { name: 'lmstudio', display: 'LM Studio (Local)', key: 'local' },
    ];

    for (const p of providers) {
      const status = p.key ? chalk.hex(theme.accent)('✓ configured') : chalk.hex(theme.textMuted)('✗ not configured');
      const isDefault = p.name === config.provider.default ? chalk.hex(theme.primary)(' (default)') : '';
      console.log(`  ${chalk.hex(theme.text)(p.display.padEnd(20))} ${status}${isDefault}`);
    }
    console.log('');
  });

// ── Plain text mode (no Ink UI) ──
async function runPlainMode(agent: CookieAgent): Promise<void> {
  const startupQuip = agent.getPersonality().quip('startup');
  console.log(chalk.hex(theme.primary)(startupQuip));
  console.log(chalk.hex(theme.textDim)('Type /help for commands, /exit to quit.\n'));

  agent.onStream = (chunk) => {
    if (chunk.type === 'token' && chunk.content) {
      process.stdout.write(chunk.content);
    }
    if (chunk.type === 'done') {
      console.log('');
    }
  };

  agent.onConfirm = async (msg) => {
    console.log(chalk.hex(theme.warning)('\n⚠️ Confirmation needed:'));
    console.log(msg);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(chalk.hex(theme.accent)('Approve? (y/n): '), (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  };

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex(theme.accent)('❯ '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) { rl.prompt(); return; }
    if (trimmed === '/exit' || trimmed === '/quit') {
      await agent.shutdown();
      process.exit(0);
    }
    if (trimmed === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }
    if (trimmed === '/help') {
      console.log(chalk.hex(theme.textDim)(`
  /exit, /quit  — Exit Cookie
  /clear        — Clear screen
  /provider <n> — Switch provider
  /model <n>    — Switch model
  /help         — This help
`));
      rl.prompt();
      return;
    }

    console.log('');
    const response = await agent.chat(trimmed);
    // Response already streamed, just add newline
    console.log('');
    rl.prompt();
  });
}

program.parse();
