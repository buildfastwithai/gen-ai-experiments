const XSS_PATTERNS = [
  {
    name: 'dangerouslySetInnerHTML',
    test: (line) => /dangerouslySetInnerHTML/i.test(line),
    severity: 'critical',
    message: 'Using dangerouslySetInnerHTML without sanitization opens you to XSS attacks.',
    fix: 'Use a sanitization library like DOMPurify before passing content, or render with standard React JSX:\n  import DOMPurify from "dompurify";\n  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />',
  },
  {
    name: 'innerHTML Assignment',
    test: (line) => /\.innerHTML\s*=/i.test(line),
    severity: 'critical',
    message: 'Setting innerHTML directly allows untrusted HTML to execute scripts.',
    fix: 'Use textContent for plain text or createElement + appendChild for safe DOM manipulation:\n  element.textContent = userInput; // safe\n  // or\n  element.appendChild(document.createTextNode(userInput));',
  },
  {
    name: 'document.write()',
    test: (line) => /document\.write\s*\(/i.test(line),
    severity: 'high',
    message: 'document.write() can be exploited for DOM-based XSS. Modern code should never use it.',
    fix: 'Replace with DOM manipulation APIs (createElement, appendChild) or framework rendering:\n  const el = document.createElement("p");\n  el.textContent = data;\n  document.body.appendChild(el);',
  },
  {
    name: 'eval() Usage',
    test: (line) => /\beval\s*\(/.test(line),
    severity: 'critical',
    message: 'eval() executes arbitrary code. This is the most dangerous function in JavaScript.',
    fix: 'There is almost always a safer alternative:\n- For JSON parsing: JSON.parse()\n- For dynamic property access: obj[key]\n- For calculations: Use dedicated math libraries',
  },
  {
    name: 'v-html Directive (Vue)',
    test: (line) => /v-html\s*=/i.test(line),
    severity: 'high',
    message: 'Vue v-html renders raw HTML. If content comes from users, this is an XSS vector.',
    fix: 'Use text interpolation ({{ }}) instead of v-html. If you must render HTML, sanitize with DOMPurify first.',
  },
  {
    name: 'Unsafe Window Functions',
    test: (line) => /(?:setTimeout|setInterval|Function)\s*\(\s*['"`]/.test(line),
    severity: 'high',
    message: 'Passing strings to setTimeout/setInterval/Function is equivalent to eval().',
    fix: 'Pass function references instead of strings:\n  setTimeout(() => doSomething(), 1000); // not setTimeout("doSomething()", 1000)',
  },
  {
    name: 'Unsanitized URL Redirect',
    test: (line) => /window\.location\s*=\s*(?!['"])[^;]+|location\.href\s*=\s*(?!['"])[^;]+/.test(line),
    severity: 'medium',
    message: 'Setting window.location from user input can lead to open redirect attacks.',
    fix: 'Validate redirect URLs against a whitelist:\n  const allowed = ["/dashboard", "/profile"];\n  if (allowed.includes(userRedirect)) { window.location = userRedirect; }',
  },
  {
    name: 'insertAdjacentHTML',
    test: (line) => /insertAdjacentHTML\s*\(/.test(line),
    severity: 'high',
    message: 'insertAdjacentHTML with untrusted input creates XSS vulnerabilities.',
    fix: 'Use insertAdjacentElement or insertAdjacentText instead. If HTML is required, sanitize with DOMPurify.',
  },
];

export function scanXSS(code) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          type: 'Cross-Site Scripting (XSS)',
          category: 'xss',
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