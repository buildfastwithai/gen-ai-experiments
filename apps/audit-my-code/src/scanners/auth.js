const AUTH_PATTERNS = [
  {
    name: 'Missing Auth Guard',
    needsAllLines: true,
    test: (lines, i) => {
      const line = lines[i];
      if (/(?:router\.(?:get|post|put|delete|patch)|app\.(?:get|post|put|delete|patch))\s*\(/.test(line) && !/auth|middleware|isAuth|requireAuth|protect|guard/i.test(line)) {
        // Check next 5 lines for auth middleware
        let hasAuth = false;
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (/auth|isAuth|requireAuth|protect|guard|middleware/i.test(lines[j])) {
            hasAuth = true;
            break;
          }
        }
        return !hasAuth;
      }
      return false;
    },
    severity: 'high',
    message: 'This route handler has no visible authentication middleware. Unauthenticated users may access protected resources.',
    fix: 'Add authentication middleware to the route:\n  router.get("/users", requireAuth, getUsers);\n  // or globally:\n  app.use("/api", requireAuth, apiRoutes);',
  },
  {
    name: 'No Rate Limiting',
    test: (line) => /(?:router|app)\.(?:get|post|put|delete|patch)\s*\(['"`]\/(?!auth)/.test(line) && !/rate.?limit|throttl/i.test(line),
    severity: 'medium',
    context: (lines, startIdx) => {
      // Check whole file for rate limiting
      return !lines.some(l => /rate.?limit|throttle|express-rate-limit/i.test(l));
    },
    message: 'No rate limiting detected. Endpoints are vulnerable to brute force and DoS attacks.',
    fix: 'Add rate limiting:\n  const rateLimit = require("express-rate-limit");\n  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });\n  app.use(limiter);',
  },
  {
    name: 'Weak JWT Verification',
    test: (line) => /jwt\.verify|jwt\.decode/i.test(line) && !/algorithms/i.test(line),
    severity: 'high',
    message: 'JWT verification without explicitly specifying algorithms is vulnerable to "alg: none" attacks.',
    fix: 'Always specify the algorithm:\n  jwt.verify(token, secret, { algorithms: ["HS256"] });',
  },
  {
    name: 'JWT Secret in Code',
    test: (line) => /jwt.*secret|JWT_SECRET\s*=\s*['"]/.test(line),
    severity: 'critical',
    message: 'Hardcoding JWT secret in source code exposes it in version control.',
    fix: 'Move to environment variable:\n  const jwtSecret = process.env.JWT_SECRET;\n  // Generate: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  },
  {
    name: 'No Session Expiry',
    test: (line) => /session|cookie/i.test(line) && !/(?:maxAge|expires|max-age)/i.test(line),
    severity: 'medium',
    message: 'Sessions without explicit expiry remain valid indefinitely, increasing risk of session hijacking.',
    fix: 'Set session expiry:\n  app.use(session({ cookie: { maxAge: 24 * 60 * 60 * 1000 } })); // 24 hours',
  },
  {
    name: 'Missing CORS Validation',
    test: (line) => /cors\s*\(\s*\)|cors\s*\(\s*\{/.test(line) && /origin\s*:\s*['"]?\*/.test(line),
    severity: 'high',
    message: 'CORS configured with wildcard origin and credentials enabled leaks data across origins.',
    fix: 'Restrict CORS to specific origins:\n  app.use(cors({ origin: ["https://yourdomain.com"], credentials: true }));',
  },
  {
    name: 'Plain Text Password Storage',
    test: (line) => /password|passwd/i.test(line) && !/(?:hash|bcrypt|argon|scrypt|encrypt)/i.test(line) && /save|insert|create|store/i.test(line),
    severity: 'critical',
    message: 'Passwords appear to be stored without hashing. This is the number one auth mistake.',
    fix: 'Hash passwords before storing:\n  const bcrypt = require("bcrypt");\n  const hashedPassword = await bcrypt.hash(password, 12);\n  await User.create({ password: hashedPassword });',
  },
  {
    name: 'Missing Input Validation',
    test: (line) => /\breq\.(?:body|query|params)\.\w+/.test(line) && !/(?:validate|sanitize|express-validator|joi|zod|yup)/i.test(line),
    severity: 'medium',
    message: 'User input is being used without visible validation. This enables injection and data integrity issues.',
    fix: 'Validate all user input:\n  const { body } = require("express-validator");\n  router.post("/user", [body("email").isEmail(), body("name").isLength({ min: 2 })], handler);',
  },
];

export function scanAuth(code) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of AUTH_PATTERNS) {
      let match = false;
      if (pattern.needsAllLines) {
        match = pattern.test(lines, i);
      } else {
        match = pattern.test(lines[i]);
      }

      if (match) {
        // Context check: some checks must pass across entire file
        if (pattern.context && pattern.context(lines, i) === false) continue;

        findings.push({
          type: 'Authentication / Authorization',
          category: 'auth',
          pattern: pattern.name,
          severity: pattern.severity,
          line: i + 1,
          column: 1,
          snippet: lines[i].trim(),
          match: pattern.name,
          message: pattern.message,
          fix: pattern.fix,
        });
      }
    }
  }

  return findings;
}
