const SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, severity: 'critical' },
  { name: 'AWS Secret Key', regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, severity: 'critical' },
  { name: 'GitHub Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}/g, severity: 'critical' },
  { name: 'Stripe Secret Key', regex: /(?:sk_live|sk_test)_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{32,}/g, severity: 'critical' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/g, severity: 'high' },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, severity: 'critical' },
  { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)\s*[:=]\s*['"]?[\w-]{20,}['"]?/gi, severity: 'high' },
  { name: 'Password in Code', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, severity: 'high' },
  { name: 'Database URL', regex: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/gi, severity: 'critical' },
  { name: 'Webhook URL', regex: /https:\/\/hooks\.(?:slack|discord)\.com\/[A-Za-z0-9/_=-]+/g, severity: 'medium' },
  { name: 'Firebase URL', regex: /https:\/\/[a-z0-9-]+\.firebaseio\.com/g, severity: 'high' },
  { name: 'Hardcoded Token', regex: /(?:token|auth|bearer)\s*[:=]\s*['"]([A-Za-z0-9_\-.]{16,})['"]/gi, severity: 'high' },
];

export function scanSecrets(code) {
  const findings = [];
  const lines = code.split('\n');

  for (const pattern of SECRET_PATTERNS) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(code)) !== null) {
      const lineNumber = code.substring(0, match.index).split('\n').length;
      const line = lines[lineNumber - 1]?.trim() || '';
      const maskedValue = match[0].length > 8
        ? match[0].substring(0, 4) + '•'.repeat(Math.min(match[0].length - 8, 20)) + match[0].slice(-4)
        : '••••';
      findings.push({
        type: 'Secret Exposure',
        category: 'secrets',
        pattern: pattern.name,
        severity: pattern.severity,
        line: lineNumber,
        column: (match.index - code.lastIndexOf('\n', match.index - 1)),
        snippet: line,
        match: maskedValue,
        fix: `Move this ${pattern.name} to an environment variable (.env) and never commit secrets.\n\nRecommended fix:\n1. Add to .env: ${pattern.name.toUpperCase().replace(/\s+/g, '_')}=<your_value>\n2. Reference via process.env.EXAMPLE_KEY\n3. Add .env to .gitignore`,
        message: `${maskedValue} appears to be an ${pattern.name}. This should never be in source code.`,
      });
    }
  }

  return findings;
}