const INJECTION_PATTERNS = [
  {
    name: 'String Concatenation in SQL',
    test: (line) => /(?:execute|query|raw)\s*\(\s*['"`].*\+|['"`]\s*\+\s*.*\)/.test(line) || /(?:\.query|\.execute)\s*\(\s*['"`]/.test(line),
    type: 'SQL Injection',
    severity: 'critical',
    check: (line) => {
      if (/SELECT|INSERT|UPDATE|DELETE|DROP/i.test(line)) {
        if (/['"`]\s*\+\s*|\.concat\(/.test(line) || /\$\{/.test(line)) {
          return true;
        }
      }
      return false;
    },
    message: 'Building SQL queries with string concatenation or template literals allows SQL injection.',
    fix: 'Use parameterized queries:\n  // Bad: db.query("SELECT * FROM users WHERE id = " + userId)\n  // Good: db.query("SELECT * FROM users WHERE id = ?", [userId])',
  },
  {
    name: 'Unparameterized Query',
    type: 'SQL Injection',
    test: (line) => /\.(?:query|execute)\s*\(\s*`[^`]*\$\{[^}]*\}[^`]*`/.test(line),
    severity: 'critical',
    message: 'Template literals with embedded variables in SQL queries are injectable.',
    fix: 'Replace template literals with parameterized queries:\n  // Bad: db.query(`SELECT * FROM users WHERE email = "${email}"`)\n  // Good: db.query("SELECT * FROM users WHERE email = ?", [email])',
  },
  {
    name: 'OS Command Injection',
    type: 'Command Injection',
    test: (line) => /(?:exec|spawn|execSync|execFile)\s*\(/.test(line) && /['"`].*\+|`\$\{/.test(line),
    severity: 'critical',
    message: 'Building shell commands with user input enables command injection.',
    fix: 'Use execFile instead of exec and pass arguments as an array:\n  // Bad: exec("rm -rf " + userDir)\n  // Good: execFile("rm", ["-rf", userDir])',
  },
  {
    name: 'Unsafe eval with User Input',
    type: 'Code Injection',
    test: (line) => /\beval\(/.test(line) && !/['"]/.test(line),
    severity: 'critical',
    message: 'Using eval() with variable input is code injection.',
    fix: 'Never use eval() with dynamic input. Use JSON.parse() for data, Map/Set for lookups, or function references for callbacks.',
  },
  {
    name: 'LDAP Injection Risk',
    type: 'LDAP Injection',
    test: (line) => /ldap.*search|search.*ldap/i.test(line) && /['"`].*\+|`\$\{/.test(line),
    severity: 'high',
    message: 'Building LDAP queries with string concatenation may allow LDAP injection.',
    fix: 'Escape special LDAP characters (*, (, ), \\, NUL) before interpolation, or use an LDAP library that handles escaping.',
  },
  {
    name: 'NoSQL Injection Risk (MongoDB)',
    type: 'NoSQL Injection',
    test: (line) => /\$where|\.find\s*\(\s*\{/.test(line) && /req\.(?:body|query|params)/i.test(line),
    severity: 'high',
    message: 'Passing raw user input to MongoDB $where or find() operators enables NoSQL injection.',
    fix: 'Sanitize and validate query objects with a library like mongo-sanitize:\n  const sanitize = require("mongo-sanitize");\n  const clean = sanitize(req.body);',
  },
  {
    name: 'Path Traversal Risk',
    type: 'Path Traversal',
    test: (line) => /(?:readFile|readFileSync|open|createReadStream)\s*\(.+req\.(?:body|query|params)/i.test(line),
    severity: 'high',
    message: 'Using user input directly in file path operations enables path traversal attacks.',
    fix: 'Resolve paths safely:\n  const safePath = path.resolve(__dirname, "uploads", path.basename(userFile));\n  fs.readFile(safePath, callback);',
  },
  {
    name: 'XML External Entity (XXE)',
    type: 'XXE Injection',
    test: (line) => /xml2js|xml-js|parseXML|DOMParser/i.test(line) && !/noent.*false|externalEntities.*false/i.test(line),
    severity: 'high',
    message: 'XML parsers with external entities enabled are vulnerable to XXE attacks.',
    fix: 'Disable external entities in XML parser:\n  const parser = new DOMParser();\n  // Set parser options to disable DTDs and external entities',
  },
];

export function scanInjections(code) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of INJECTION_PATTERNS) {
      const hasInjection = pattern.check ? pattern.check(line) : pattern.test(line);
      if (hasInjection) {
        findings.push({
          type: pattern.type,
          category: 'injection',
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