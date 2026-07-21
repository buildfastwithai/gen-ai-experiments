const { spawn, execSync } = require('child_process');
const path = require('path');

// Auto-install skillspector if it's missing
try {
    execSync('skillspector --help', { stdio: 'ignore' });
} catch (e) {
    console.log('Checking for code...');
    try {
        execSync('uv tool install git+https://github.com/NVIDIA/skillspector.git', { stdio: 'ignore', shell: true });
    } catch (e2) {
        try {
            execSync('pip install git+https://github.com/NVIDIA/skillspector.git', { stdio: 'ignore', shell: true });
        } catch (e3) {
            console.error('[skill-check] Error: Failed to auto-install. Please ensure Python is installed and run: pip install git+https://github.com/NVIDIA/skillspector.git');
            process.exit(1);
        }
    }
}

// Extract arguments, dropping 'node' and the script name
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Skill-Check CLI
A Node.js wrapper for NVIDIA SkillSpector to evaluate AI agent skills.

Usage:
  skill-check <URL_OR_PATH> [options]

Example:
  skill-check https://github.com/vercel-labs/agent-browser
  skill-check ./my-local-skill --no-llm

Note: Requires Python 3.12+ and 'skillspector' to be installed and available in your PATH.
    `);
    process.exit(0);
}

// Prepare the arguments for the skillspector scan command
const skillspectorArgs = ['scan', ...args];

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIdx = 0;
let timeSec = 0;

console.log(`[skill-check] Starting security scan...`);

// Start the spinner and timer
const spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${spinnerFrames[spinnerIdx]} Scanning and analyzing... (${timeSec}s) `);
    spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
}, 100);

const timerInterval = setInterval(() => {
    timeSec++;
}, 1000);

// Spawn the Python skillspector process
const child = spawn('skillspector', skillspectorArgs, {
    stdio: 'inherit', // Stream stdin, stdout, stderr directly to the terminal
    shell: true       // Use shell so it resolves via PATH
});

child.on('error', (err) => {
    clearInterval(spinnerInterval);
    clearInterval(timerInterval);
    process.stdout.write('\r\x1b[K'); // clear the spinner line
    console.error('\n[skill-check] Error: Failed to start skillspector.');
    console.error('Make sure SkillSpector is installed and available on your PATH.');
    console.error(`\nDetails: ${err.message}`);
    process.exit(1);
});

child.on('close', (code) => {
    clearInterval(spinnerInterval);
    clearInterval(timerInterval);
    process.stdout.write('\r\x1b[K'); // clear the spinner line
    
    if (code !== 0) {
        console.log(`\n[skill-check] Scan completed with risk issues (Exit Code: ${code}). Time: ${timeSec}s`);
    } else {
        console.log(`\n[skill-check] Scan completed successfully. Skill appears safe. Time: ${timeSec}s`);
    }
    process.exit(code);
});
