import { scanSecrets } from './secrets.js';
import { scanXSS } from './xss.js';
import { scanInjections } from './injection.js';
import { scanCrypto } from './crypto.js';
import { scanAuth } from './auth.js';

export function runFullAudit(code) {
  const startTime = performance.now();
  // FileReader and imported config files can occasionally yield null. A local
  // audit should treat that as an empty file, not leave the UI in a failed state.
  const source = typeof code === 'string' ? code : String(code ?? '');

  const results = {
    secrets: scanSecrets(source),
    xss: scanXSS(source),
    injection: scanInjections(source),
    crypto: scanCrypto(source),
    auth: scanAuth(source),
  };

  const totalFindings =
    results.secrets.length +
    results.xss.length +
    results.injection.length +
    results.crypto.length +
    results.auth.length;

  const critical = Object.values(results).flat().filter(f => f.severity === 'critical').length;
  const high = Object.values(results).flat().filter(f => f.severity === 'high').length;
  const medium = Object.values(results).flat().filter(f => f.severity === 'medium').length;

  const lines = source.split('\n').filter(l => l.trim()).length;

  const endTime = performance.now();

  return {
    summary: {
      totalFindings,
      critical,
      high,
      medium,
      linesScanned: lines,
      scanTimeMs: Math.round(endTime - startTime),
      categories: {
        secrets: results.secrets.length,
        xss: results.xss.length,
        injection: results.injection.length,
        crypto: results.crypto.length,
        auth: results.auth.length,
      },
      score: calculateScore({ critical, high, medium, totalFindings }),
    },
    findings: results,
  };
}

function calculateScore({ critical, high, medium, totalFindings }) {
  if (totalFindings === 0) return 100;
  let score = 100;
  score -= critical * 25;
  score -= high * 10;
  score -= medium * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };
export const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300', ring: 'ring-red-500/20' },
  high:     { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300', ring: 'ring-orange-500/20' },
  medium:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300', ring: 'ring-yellow-500/20' },
};

export const CATEGORY_LABELS = {
  secrets: 'Secret Exposure',
  xss: 'Cross-Site Scripting',
  injection: 'Code Injection',
  crypto: 'Weak Cryptography',
  auth: 'Authentication',
  'ai-review': 'AI Deep Review',
};
