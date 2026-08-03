// Terminal output helpers. No dependencies, degrades to plain text when piped.

const enabled =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';

const wrap = (code) => (s) => (enabled ? `[${code}m${s}[0m` : String(s));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  cyan: wrap('36'),
};

// The legacy Windows console lacks these glyphs; Windows Terminal, VS Code, and
// the MSYS shells (Git Bash) all render them.
const unicode =
  process.platform !== 'win32' ||
  Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM || process.env.MSYSTEM);

export const sym = {
  ok: unicode ? '✔' : 'OK',
  fail: unicode ? '✖' : 'XX',
  warn: unicode ? '!' : '--',
  arrow: unicode ? '→' : '->',
  bullet: unicode ? '•' : '*',
};

export function heading(text) {
  console.log(`\n${c.bold(text)}`);
}

export function line(text = '') {
  console.log(text);
}

export function hint(text) {
  console.log(c.dim(`   ${sym.arrow} ${text}`));
}

/** Pad for column alignment, measuring the string without its escape codes. */
export function pad(text, width) {
  const visible = String(text).replace(/\[\d+m/g, '');
  return text + ' '.repeat(Math.max(0, width - visible.length));
}

export function list(items) {
  for (const item of items) console.log(`  ${c.dim(sym.bullet)} ${item}`);
}
