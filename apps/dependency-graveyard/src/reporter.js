// reporter.js - Renders a beautiful colored terminal report

import chalk from 'chalk';
import Table from 'cli-table3';

const RISK_COLOR = {
    CRITICAL: chalk.bgRed.white.bold,
    HIGH:     chalk.red.bold,
    MEDIUM:   chalk.yellow.bold,
    SAFE:     chalk.green,
    UNKNOWN:  chalk.gray,
};

const RISK_EMOJI = {
    CRITICAL: '💀',
    HIGH:     '🔴',
    MEDIUM:   '🟡',
    SAFE:     '✅',
    UNKNOWN:  '❓',
};

function formatDate(date) {
    if (!date) return chalk.gray('unknown');
    return date.toISOString().split('T')[0];
}

function printReport(results, source) {
    const flagged = results.filter(r => r.risk !== 'SAFE' && r.risk !== 'UNKNOWN');
    const safe = results.filter(r => r.risk === 'SAFE');

    console.log('\n' + chalk.bold.cyan('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║         🪦  Dependency Graveyard Report                  ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`  Source: ${source}`));
    console.log(chalk.gray(`  Scanned: ${new Date().toUTCString()}\n`));

    // Summary bar
    const critical = results.filter(r => r.risk === 'CRITICAL').length;
    const high = results.filter(r => r.risk === 'HIGH').length;
    const medium = results.filter(r => r.risk === 'MEDIUM').length;

    console.log(chalk.bold('  Risk Summary:'));
    console.log(`  ${chalk.bgRed.white.bold(` 💀 CRITICAL: ${critical} `)}  ${chalk.red.bold(`🔴 HIGH: ${high}`)}  ${chalk.yellow.bold(`🟡 MEDIUM: ${medium}`)}  ${chalk.green(`✅ SAFE: ${safe.length}`)}\n`);

    if (flagged.length === 0) {
        console.log(chalk.green.bold('  🎉 All dependencies look healthy!\n'));
        return;
    }

    // Flagged packages table
    const table = new Table({
        head: [
            chalk.bold('Package'),
            chalk.bold('Ecosystem'),
            chalk.bold('Risk'),
            chalk.bold('Last Published'),
            chalk.bold('Reason'),
        ],
        colWidths: [30, 10, 12, 16, 45],
        wordWrap: true,
        style: { head: [], border: ['gray'] },
    });

    // Sort by risk severity
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, UNKNOWN: 3, SAFE: 4 };
    const sorted = [...results].sort((a, b) => (order[a.risk] ?? 4) - (order[b.risk] ?? 4));

    for (const pkg of sorted) {
        if (pkg.risk === 'SAFE') continue;
        const colorFn = RISK_COLOR[pkg.risk] || chalk.white;
        table.push([
            chalk.bold(pkg.name),
            chalk.cyan(pkg.ecosystem),
            colorFn(`${RISK_EMOJI[pkg.risk]} ${pkg.risk}`),
            formatDate(pkg.lastPublished),
            pkg.reasons.join('\n'),
        ]);
    }

    console.log(table.toString());
    console.log();
}

/**
 * Formats results as a plain text string for Slack.
 */
function formatForSlack(results, source, aiSummary) {
    const critical = results.filter(r => r.risk === 'CRITICAL').length;
    const high = results.filter(r => r.risk === 'HIGH').length;
    const medium = results.filter(r => r.risk === 'MEDIUM').length;
    const safe = results.filter(r => r.risk === 'SAFE').length;
    const flagged = results.filter(r => r.risk !== 'SAFE' && r.risk !== 'UNKNOWN');

    let text = `*🪦 Dependency Graveyard Report*\n`;
    text += `*Source:* ${source}\n`;
    text += `*Scanned:* ${new Date().toUTCString()}\n\n`;
    text += `*Risk Summary:* 💀 CRITICAL: ${critical}  🔴 HIGH: ${high}  🟡 MEDIUM: ${medium}  ✅ SAFE: ${safe}\n\n`;

    if (aiSummary) {
        text += `*🧠 AI Summary:*\n${aiSummary}\n\n`;
    }

    if (flagged.length > 0) {
        text += `*Flagged Packages:*\n`;
        for (const pkg of flagged.slice(0, 20)) { // Slack has message limits
            text += `• \`${pkg.name}\` (${pkg.ecosystem}) — *${pkg.risk}* — ${pkg.reasons[0]}\n`;
        }
        if (flagged.length > 20) {
            text += `_...and ${flagged.length - 20} more._\n`;
        }
    } else {
        text += `✅ All dependencies look healthy!\n`;
    }

    return text;
}

export { printReport, formatForSlack };
