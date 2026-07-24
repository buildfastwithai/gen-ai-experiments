// cli.js - Main entry point: orchestrates all modules

import 'dotenv/config';
import chalk from 'chalk';
import { fetchFromGitHub, fetchFromLocal } from './fetcher.js';
import { parsePackageJson, parseRequirementsTxt } from './parsers.js';
import { checkAll } from './checker.js';
import { printReport, formatForSlack } from './reporter.js';
import { postToSlack } from './slack.js';

const args = process.argv.slice(2);
const noSlack = args.includes('--no-slack');
const noLlm = args.includes('--no-llm');
const inputArg = args.find(a => !a.startsWith('--'));

async function getAiSummary(results) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const flagged = results.filter(r => r.risk !== 'SAFE' && r.risk !== 'UNKNOWN');
    if (flagged.length === 0) return 'All dependencies are healthy. No action needed.';

    const summaryInput = flagged.map(p =>
        `${p.name} (${p.ecosystem}): ${p.risk} — ${p.reasons.join(', ')}`
    ).join('\n');

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [{
                    role: 'user',
                    content: `You are a senior software engineer reviewing dependency risks. Here is the list of flagged packages:\n\n${summaryInput}\n\nWrite a concise 3-sentence plain English summary of the overall risk and the top 1-2 most important packages to fix first. Be specific and actionable.`,
                }],
                max_tokens: 200,
            }),
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log(chalk.bold.cyan('\n🪦 dep-graveyard — Dependency Risk Scanner\n'));

    // Step 1: Fetch files
    let files;
    let source;

    try {
        if (inputArg && inputArg.startsWith('http')) {
            console.log(chalk.gray(`  📥 Fetching from GitHub: ${inputArg}...`));
            files = await fetchFromGitHub(inputArg);
            source = inputArg;
        } else {
            const dir = inputArg || process.cwd();
            console.log(chalk.gray(`  📂 Scanning local directory: ${dir}...`));
            files = fetchFromLocal(dir);
            source = dir;
        }
    } catch (e) {
        console.error(chalk.red(`\n  ❌ Error: ${e.message}\n`));
        process.exit(1);
    }

    // Step 2: Parse packages
    const npmPackages = files['package.json']
        ? parsePackageJson(files['package.json'])
        : [];
    const pypiPackages = files['requirements.txt']
        ? parseRequirementsTxt(files['requirements.txt'])
        : [];

    if (npmPackages.length === 0 && pypiPackages.length === 0) {
        console.error(chalk.red('  ❌ No packages found to scan.\n'));
        process.exit(1);
    }

    const total = npmPackages.length + pypiPackages.length;
    console.log(chalk.gray(`  🔍 Found ${npmPackages.length} npm + ${pypiPackages.length} PyPI packages (${total} total)`));

    // Animated spinner while checking
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let idx = 0;
    let checked = 0;
    const spinner = setInterval(() => {
        process.stdout.write(`\r  ${frames[idx]} Checking packages against npm & PyPI registries... (${checked}/${total})`);
        idx = (idx + 1) % frames.length;
    }, 100);

    // Step 3: Check packages
    const results = await checkAll(npmPackages, pypiPackages);
    checked = total;
    clearInterval(spinner);
    process.stdout.write('\r\x1b[K');

    // Step 4: Print terminal report
    printReport(results, source);

    // Step 5: Get AI summary
    let aiSummary = null;
    if (!noLlm) {
        if (process.env.GROQ_API_KEY) {
            process.stdout.write(chalk.gray('  🧠 Getting AI summary...'));
            aiSummary = await getAiSummary(results);
            process.stdout.write('\r\x1b[K');
            if (aiSummary) {
                console.log(chalk.bold('\n  🧠 AI Summary:'));
                console.log(chalk.white(`  ${aiSummary}\n`));
            }
        } else {
            console.log(chalk.gray('  💡 Tip: Set GROQ_API_KEY in .env for a free AI-powered summary. Get one at console.groq.com\n'));
        }
    }

    // Step 6: Post to Slack
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!noSlack && webhookUrl) {
        try {
            process.stdout.write(chalk.gray('  📣 Posting to Slack...'));
            const slackText = formatForSlack(results, source, aiSummary);
            await postToSlack(webhookUrl, slackText);
            process.stdout.write('\r\x1b[K');
            console.log(chalk.green('  ✅ Report posted to Slack!\n'));
        } catch (e) {
            process.stdout.write('\r\x1b[K');
            console.log(chalk.yellow(`  ⚠️  Slack notification failed: ${e.message}\n`));
        }
    } else if (!noSlack && !webhookUrl) {
        console.log(chalk.gray('  💡 Tip: Set SLACK_WEBHOOK_URL in .env to get Slack notifications.\n'));
    }

    const flaggedCount = results.filter(r => r.risk !== 'SAFE' && r.risk !== 'UNKNOWN').length;
    process.exit(flaggedCount > 0 ? 1 : 0);
}

main();
