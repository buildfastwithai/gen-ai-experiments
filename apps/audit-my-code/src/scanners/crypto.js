const CRYPTO_PATTERNS = [
  {
    name: 'MD5 Hash Usage',
    test: (line) => /\bmd5\b/i.test(line) && /hash|digest|checksum/i.test(line),
    severity: 'critical',
    message: 'MD5 is cryptographically broken and should never be used for security purposes.',
    fix: 'Replace MD5 with SHA-256 or SHA-3 for hashing. For passwords, use bcrypt, argon2, or scrypt:\n  const crypto = require("crypto");\n  const hash = crypto.createHash("sha256").update(data).digest("hex");',
  },
  {
    name: 'SHA-1 Hash Usage',
    test: (line) => /\bsha1\b/i.test(line) && /hash|digest|checksum/i.test(line),
    severity: 'high',
    message: 'SHA-1 is vulnerable to collision attacks. Avoid for security-critical applications.',
    fix: 'Upgrade to SHA-256 or SHA-3:\n  crypto.createHash("sha256").update(data).digest("hex");',
  },
  {
    name: 'DES Encryption',
    test: (line) => /\bdes\b/i.test(line) && !/3des|triple.?des/i.test(line),
    severity: 'critical',
    message: 'DES is trivially breakable with modern hardware. Never use for encryption.',
    fix: 'Use AES-256-GCM for symmetric encryption:\n  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);',
  },
  {
    name: 'ECB Mode Encryption',
    test: (line) => /ecb/i.test(line) && /cipher|crypto/i.test(line),
    severity: 'critical',
    message: 'ECB mode reveals data patterns (the famous "ECB penguin"). Identical plaintext blocks produce identical ciphertext.',
    fix: 'Use AES-GCM or CBC with proper IV:\n  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);',
  },
  {
    name: 'Hardcoded Encryption Key',
    test: (line) => /(?:key|secret|iv)\s*[:=]\s*['"][\w+/=]{8,}['"]/i.test(line),
    severity: 'critical',
    message: 'Hardcoding cryptographic keys in source code exposes them in version control and builds.',
    fix: 'Store keys in environment variables or a secrets manager (AWS KMS, HashiCorp Vault):\n  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");',
  },
  {
    name: 'Weak Key Size (RSA < 2048)',
    test: (line) => /\b1024\b/.test(line) && /rsa|key/i.test(line),
    severity: 'high',
    message: 'RSA keys below 2048 bits are considered weak against modern attacks.',
    fix: 'Generate at least 2048-bit RSA keys. 4096 is recommended for high-security applications.',
  },
  {
    name: 'Math.random() for Security',
    test: (line) => /Math\.random\(\)/.test(line) && /(?:token|key|secret|password|crypto|auth|random|id)/i.test(line),
    severity: 'high',
    message: 'Math.random() is not cryptographically secure. Predictable random values break security.',
    fix: 'Use crypto.randomBytes() or crypto.randomUUID():\n  const crypto = require("crypto");\n  const token = crypto.randomBytes(32).toString("hex");',
  },
  {
    name: 'No Salt in Password Hash',
    test: (line) => /hash.*password|password.*hash/i.test(line) && !/salt|bcrypt|argon|scrypt/i.test(line),
    severity: 'high',
    message: 'Hashing passwords without salt makes them vulnerable to rainbow table attacks.',
    fix: 'Use bcrypt, argon2, or scrypt which handle salting automatically:\n  const bcrypt = require("bcrypt");\n  const hash = await bcrypt.hash(password, 12);',
  },
  {
    name: 'Custom Crypto Implementation',
    test: (line) => /custom.*(?:encrypt|decrypt|cipher|hash)|own.*(?:encrypt|decrypt|cipher|hash)/i.test(line),
    severity: 'critical',
    message: 'Never roll your own crypto. Custom implementations are almost always vulnerable.',
    fix: 'Use well-audited libraries: OpenSSL (via Node crypto module), libsodium, or Web Crypto API for browser.',
  },
  {
    name: 'Reused IV / Nonce',
    test: (line) => /iv\s*=\s*['"][^'"]{4,}['"]/i.test(line),
    severity: 'high',
    message: 'Hardcoding an IV means the same plaintext always produces the same ciphertext, defeating encryption.',
    fix: 'Generate a random IV for each encryption operation:\n  const iv = crypto.randomBytes(16); // Always unique per encryption',
  },
];

export function scanCrypto(code) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of CRYPTO_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          type: 'Weak Cryptography',
          category: 'crypto',
          pattern: pattern.name,
          severity: pattern.severity,
          line: i + 1,
          column: 1,
          snippet: line.trim(),
          match: pattern.name,
          message: pattern.message,
          fix: pattern.fix,
        });
      }
    }
  }

  return findings;
}