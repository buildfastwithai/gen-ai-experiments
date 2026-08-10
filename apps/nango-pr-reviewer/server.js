const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const reviews = new Map();

const demoPullRequest = {
  owner: 'acme-cloud',
  repo: 'payments-api',
  number: 1842,
  title: 'Add invoice retry state',
  body: 'Implements ENG-482 and aligns with the Billing architecture v2 decision record.',
  user: { login: 'jordan-mitchell' },
  additions: 248,
  deletions: 31,
  changed_files: 6
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, body, contentType) {
  response.writeHead(status, { 'Content-Type': contentType });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error('Request body is too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function parseJsonBody(rawBody) {
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new Error('Request body must be valid JSON');
  }
}

function verifyGithubSignature(rawBody, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function nangoUrl(apiPath) {
  const host = (process.env.NANGO_HOST || 'https://api.nango.dev').replace(/\/$/, '');
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${host}/proxy${normalizedPath}`;
}

async function nangoRequest({ providerConfigKey, connectionId, apiPath, method = 'GET', body }) {
  if (!process.env.NANGO_SECRET_KEY) {
    throw new Error('NANGO_SECRET_KEY is not configured');
  }
  if (!providerConfigKey) {
    throw new Error('A Nango provider config key is required');
  }
  if (!connectionId) {
    throw new Error('NANGO_CONNECTION_ID is not configured');
  }

  const headers = {
    Authorization: `Bearer ${process.env.NANGO_SECRET_KEY}`,
    'Connection-Id': connectionId,
    'Provider-Config-Key': providerConfigKey,
    Accept: 'application/json'
  };
  if (body) headers['Content-Type'] = 'application/json';

  const result = await fetch(nangoUrl(apiPath), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const responseText = await result.text();
  let responseBody;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }
  if (!result.ok) {
    throw new Error(`Nango ${result.status}: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`);
  }
  return responseBody;
}

function getConnectionId(payload) {
  return payload.connectionId || process.env.NANGO_GITHUB_CONNECTION_ID || process.env.NANGO_CONNECTION_ID || String(payload.installation?.id || '');
}

function getSourceConnectionId(source) {
  return process.env[`NANGO_${source.toUpperCase()}_CONNECTION_ID`] || process.env.NANGO_CONNECTION_ID || '';
}

function findNotionIds(text = '') {
  return [...new Set((text.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|[a-f0-9]{32}/gi) || []).map((id) => id.replace(/-/g, '')))];
}

async function fetchGithubContext(pr, connectionId) {
  const configKey = process.env.NANGO_GITHUB_CONFIG_KEY || 'github';
  const [pullRequest, comments, files] = await Promise.all([
    nangoRequest({ providerConfigKey: configKey, connectionId, apiPath: `/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}` }),
    nangoRequest({ providerConfigKey: configKey, connectionId, apiPath: `/repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments` }),
    nangoRequest({ providerConfigKey: configKey, connectionId, apiPath: `/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/files` })
  ]);
  return { pullRequest, comments, files };
}

function notionBlockText(block) {
  const content = block[block.type] || {};
  const richText = content.rich_text || content.text || [];
  const text = richText.map((item) => item.plain_text || item.text?.content || '').join('');
  if (!text) return '';
  if (block.type === 'heading_1') return `# ${text}`;
  if (block.type === 'heading_2') return `## ${text}`;
  if (block.type === 'heading_3') return `### ${text}`;
  if (block.type === 'bulleted_list_item') return `- ${text}`;
  if (block.type === 'numbered_list_item') return `1. ${text}`;
  if (block.type === 'to_do') return `- [${content.checked ? 'x' : ' '}] ${text}`;
  if (block.type === 'code') return `\`${content.language || 'text'}\` ${text}`;
  return text;
}

async function fetchNotionBlocks(pageId, connectionId) {
  const blocks = [];
  let cursor = '';
  do {
    const query = `?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`;
    const response = await nangoRequest({
      providerConfigKey: process.env.NANGO_NOTION_CONFIG_KEY,
      connectionId,
      apiPath: `/v1/blocks/${pageId}/children${query}`
    });
    blocks.push(...(response?.results || []));
    cursor = response?.next_cursor || '';
  } while (cursor && blocks.length < 500);
  return blocks;
}

function notionPageTitle(page) {
  const titleProperty = Object.values(page.properties || {}).find((property) => property.type === 'title');
  return titleProperty?.title?.map((item) => item.plain_text || '').join('') || 'Untitled Notion page';
}

async function fetchNotionContext(pageIds, connectionId) {
  if (!pageIds.length || !connectionId || !process.env.NANGO_NOTION_CONFIG_KEY) return [];
  const pages = await Promise.all(pageIds.map(async (pageId) => {
    try {
      const [page, blocks] = await Promise.all([
        nangoRequest({
          providerConfigKey: process.env.NANGO_NOTION_CONFIG_KEY,
          connectionId,
          apiPath: `/v1/pages/${pageId}`
        }),
        fetchNotionBlocks(pageId, connectionId)
      ]);
      return { id: pageId, title: notionPageTitle(page), url: page.url, text: blocks.map(notionBlockText).filter(Boolean).join('\n') };
    } catch (error) {
      console.error(`Notion context failed for ${pageId}: ${error.message}`);
      return null;
    }
  }));
  return pages.filter(Boolean);
}

function normalizeText(value, maxLength = 7_000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function serializeFiles(files) {
  return files.map((file) => `FILE: ${file.filename}\nSTATUS: ${file.status}\nPATCH:\n${file.patch || '(binary or patch unavailable)'}`).join('\n\n').slice(0, 28_000);
}

function makePrompt(context) {
  const checklist = [
    'Security: secrets, authentication and authorization, injection, eval/exec, unsafe deserialization, path traversal, SSRF, shell commands, XSS, insecure TLS, and sensitive data in logs.',
    'Correctness: null or missing input, malformed payloads, boundary conditions, indexing, state transitions, race conditions, duplicate events, idempotency, and backwards compatibility.',
    'Reliability: timeouts, retries, rate limits, resource cleanup, transaction boundaries, partial failures, exception handling, and useful error messages.',
    'Performance: unbounded loops or payloads, N+1 requests, blocking work, unnecessary repeated work, and missing pagination.',
    'API and operations: input validation, response status handling, breaking contract changes, configuration, observability, and safe defaults.',
    'Testing and maintainability: missing tests for changed behavior, untested failure paths, confusing abstractions, dead code, and documentation that no longer matches behavior.'
  ].join('\n- ');
  return `You are an expert pull request reviewer, similar to CodeRabbit. Review every changed function and follow the complete checklist below before deciding there are no findings. Review only the supplied diff and context. Do not praise code or invent issues. Only report a finding when it is actionable and grounded in a changed line. A hardcoded credential, eval on user-controlled input, unsafe shell command, missing authorization, or swallowed failure is a real finding and must not be ignored. Return valid JSON with exactly these keys: summary (string), walkthrough (array of short strings), tests (string), risk (one of low, medium, high), findings (array). Each finding must contain category (one of security, correctness, reliability, performance, api, testing, maintainability), path (exact changed file path), line (integer on a changed line), side (RIGHT), severity (one of blocker, warning, suggestion), title (short), and body (specific explanation and fix). If there are no real findings after checking every category, return an empty findings array.\n\nREVIEW CHECKLIST:\n- ${checklist}\n\nPULL REQUEST:\n${normalizeText(JSON.stringify(context.pullRequest))}\n\nDIFF:\n${context.diff}\n\nREVIEW DISCUSSION:\n${normalizeText(JSON.stringify(context.comments))}\n\nDESIGN DOCS:\n${normalizeText(JSON.stringify(context.notion))}`;
}

function fallbackReview(context) {
  const title = context.pullRequest.title || demoPullRequest.title;
  const firstPath = context.files[0]?.filename || 'src/billing/retry-worker.ts';
  return {
    summary: `${title} connects the implementation to its linked product context. This is a demo review response; configure an LLM key for generated analysis.`,
    walkthrough: [`Inspected ${context.filesCount || 0} changed files and the pull request discussion.`, 'Reviewed the pull request description and linked documentation for context.', 'Checked the changed flow for failure handling and idempotency risks.'],
    tests: 'Verify the retry state transitions, duplicate webhook handling, and exhausted-invoice event with focused tests.',
    risk: 'medium',
    findings: [
      { category: 'reliability', path: firstPath, line: 42, side: 'RIGHT', severity: 'warning', title: 'Retry state may be committed before the worker is durable', body: 'Make sure the state transition and job enqueue happen atomically, or a process failure here could leave the invoice marked as retrying without a runnable job.' },
      { category: 'correctness', path: firstPath, line: 67, side: 'RIGHT', severity: 'suggestion', title: 'Guard duplicate webhook deliveries', body: 'This path should remain idempotent when the payment provider retries the same webhook. Consider using the provider event ID as a uniqueness key.' }
    ]
  };
}

function normalizeReview(review, context) {
  const changedPaths = new Set(context.files.map((file) => file.filename));
  const findings = Array.isArray(review.findings) ? review.findings.filter((finding) => (
    finding && changedPaths.has(finding.path) && Number.isInteger(Number(finding.line)) && Number(finding.line) > 0 && ['blocker', 'warning', 'suggestion'].includes(finding.severity)
  )).map((finding) => ({
    path: finding.path,
    line: Number(finding.line),
    side: 'RIGHT',
    category: ['security', 'correctness', 'reliability', 'performance', 'api', 'testing', 'maintainability'].includes(finding.category) ? finding.category : 'correctness',
    severity: finding.severity,
    title: normalizeText(finding.title, 120),
    body: normalizeText(finding.body, 1_000)
  })) : [];
  return {
    summary: normalizeText(review.summary || 'No summary was returned.', 2_000),
    walkthrough: Array.isArray(review.walkthrough) ? review.walkthrough.map((item) => normalizeText(item, 300)).filter(Boolean).slice(0, 5) : [],
    tests: normalizeText(review.tests || 'No test guidance was returned.', 1_000),
    risk: ['low', 'medium', 'high'].includes(review.risk) ? review.risk : 'medium',
    findings
  };
}

function changedLines(files) {
  const lines = [];
  for (const file of files) {
    let newLine = 0;
    for (const patchLine of String(file.patch || '').split('\n')) {
      const hunk = patchLine.match(/^@@ .* \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        newLine = Number(hunk[1]);
        continue;
      }
      if (!newLine) continue;
      if (patchLine.startsWith('+++')) continue;
      if (patchLine.startsWith('+')) {
        lines.push({ path: file.filename, line: newLine, text: patchLine.slice(1) });
        newLine += 1;
      } else if (!patchLine.startsWith('-')) {
        newLine += 1;
      }
    }
  }
  return lines;
}

function staticSecurityFindings(context) {
  const findings = [];
  for (const changed of changedLines(context.files)) {
    if (/\beval\s*\(/.test(changed.text) || /\bexec\s*\(/.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'blocker', title: 'Arbitrary code execution from untrusted input', body: 'Avoid eval or exec on request or event data. An attacker can execute arbitrary code; replace this with a safe parser or a strict allowlist of operations.' });
    }
    if (/\b[A-Z][A-Z0-9_]*(?:TOKEN|API[_-]?KEY|CLIENT_SECRET|SECRET_KEY)\s*=\s*["'][^"']+["']/i.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'blocker', title: 'Credential is hardcoded in source', body: 'Do not commit access tokens or secrets. Revoke this credential if it is real, remove it from Git history, and load it from a secret manager or environment variable.' });
    }
    if (/\bexcept\s*(?:Exception\s*)?:\s*$/.test(changed.text) || /catch\s*\([^)]*\)\s*\{\s*\}/.test(changed.text)) {
      findings.push({ category: 'reliability', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'warning', title: 'Broad exception handling hides failures', body: 'Catch the expected error types and log enough context to diagnose failures. Swallowing every exception can turn security or reliability bugs into silent incorrect behavior.' });
    }
    if (/\b(?:os\.system|subprocess\.[a-z_]+)\s*\(/.test(changed.text) || /\bshell\s*=\s*True\b/.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'blocker', title: 'Shell command may be injectable', body: 'Avoid building shell commands from user-controlled values. Prefer an argument array with shell execution disabled and validate every input.' });
    }
    if (/\bpickle\.loads?\s*\(/.test(changed.text) || /\byaml\.load\s*\(/.test(changed.text) && !/SafeLoader/.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'blocker', title: 'Unsafe deserialization of untrusted data', body: 'Use a safe, constrained deserializer. Pickle and unsafe YAML loaders can execute code when the payload is attacker-controlled.' });
    }
    if (/\bverify\s*=\s*False\b/.test(changed.text) || /rejectUnauthorized\s*:\s*false/i.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'warning', title: 'TLS certificate verification is disabled', body: 'Do not disable certificate verification in production. This allows man-in-the-middle attacks; fix the certificate chain or use a trusted CA.' });
    }
    if (/\binnerHTML\s*=/.test(changed.text) || /dangerouslySetInnerHTML/.test(changed.text)) {
      findings.push({ category: 'security', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'warning', title: 'Untrusted content may create an XSS risk', body: 'Sanitize or safely encode dynamic content before inserting it into HTML. Prefer text rendering APIs when markup is not required.' });
    }
    if (/\.split\([^)]*\)\s*\[\s*\d+\s*\]/.test(changed.text) || /\[["'][^"']+["']\]/.test(changed.text) && /event|request|payload|message/i.test(changed.text)) {
      findings.push({ category: 'correctness', path: changed.path, line: changed.line, side: 'RIGHT', severity: 'warning', title: 'External input is accessed without validation', body: 'Validate the payload shape and handle missing or malformed values before indexing or splitting it. Unexpected input should produce a controlled error.' });
    }
  }
  return findings;
}

function findingFamily(finding) {
  const text = `${finding.title} ${finding.body}`.toLowerCase();
  if (/credential|token|secret|api key/.test(text)) return 'credential';
  if (/eval|exec|arbitrary code|code injection/.test(text)) return 'code-execution';
  if (/input|payload|split|index/.test(text)) return 'input-validation';
  if (/exception|catch|failure/.test(text)) return 'error-handling';
  if (/shell|command/.test(text)) return 'shell-injection';
  if (/deserializ|pickle|yaml/.test(text)) return 'deserialization';
  if (/tls|certificate|verification/.test(text)) return 'tls';
  if (/xss|html|sanitize/.test(text)) return 'xss';
  return normalizeText(finding.title, 100).toLowerCase();
}

function addStaticFindings(review, context) {
  const staticFindings = staticSecurityFindings(context);
  const staticFamilies = new Set(staticFindings.map((finding) => `${finding.path}:${finding.category}:${findingFamily(finding)}`));
  const modelFindings = review.findings.filter((finding) => !staticFamilies.has(`${finding.path}:${finding.category}:${findingFamily(finding)}`));
  const findings = [...staticFindings, ...modelFindings];
  const seen = new Set();
  const uniqueFindings = findings.filter((finding) => {
    const key = `${finding.path}:${finding.line}:${finding.category}:${finding.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...review, findings: uniqueFindings, risk: uniqueFindings.some((finding) => finding.severity === 'blocker') ? 'high' : review.risk };
}

async function generateReview(context) {
  if (!process.env.OPENAI_API_KEY) return { review: addStaticFindings(fallbackReview(context), context), mode: 'demo' };
  const result = await fetch(process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: makePrompt(context) }]
    })
  });
  if (!result.ok) throw new Error(`LLM ${result.status}: ${await result.text()}`);
  const payload = await result.json();
  const review = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
  return { review: addStaticFindings(normalizeReview(review, context), context), mode: 'live' };
}

function reviewBody(review, actor, context) {
  const intro = actor ? `@${actor}: Here are some suggestions for improvements:` : 'Here are some suggestions for improvements:';
  const suggestions = review.findings.length
    ? review.findings.map((finding, index) => `${index + 1}. **${finding.title}:** ${finding.body} _[${finding.category}, ${finding.path}, line ${finding.line}]_`).join('\n\n')
    : 'No actionable suggestions were found in this pass.';
  const walkthrough = review.walkthrough.length ? `\n\n**Review summary:**\n${review.summary}\n\n**What was checked:**\n${review.walkthrough.map((step) => `- ${step}`).join('\n')}` : '';
  const linkedSources = [
    context.notion.length ? `Notion: ${context.notion.map((page) => page.title).join(', ')}` : ''
  ].filter(Boolean);
  const sourceNote = linkedSources.length ? `\n\n_Context used: ${linkedSources.join(' · ')}_` : '';
  return `> [!TIP]\n> For best results, initiate chat on the files or code changes.\n\n${intro}\n\n${suggestions}${walkthrough}${sourceNote}\n\nThese suggestions help maintain code quality and ensure the application performs reliably.\n\nWould you like to address these suggestions now, or should we open a follow-up issue for later consideration?\n\n_Generated by Context using Nango._`;
}

async function publishGithubComment(context, review, shouldPublish, actor) {
  if (!shouldPublish || context.mode !== 'live') return false;
  await nangoRequest({
    providerConfigKey: process.env.NANGO_GITHUB_CONFIG_KEY || 'github',
    connectionId: context.connectionId,
    apiPath: `/repos/${context.owner}/${context.repo}/issues/${context.number}/comments`,
    method: 'POST',
    body: { body: reviewBody(review, actor, context) }
  });
  return true;
}

function slackReviewText(context, review) {
  const counts = review.findings.reduce((result, finding) => {
    result[finding.severity] = (result[finding.severity] || 0) + 1;
    return result;
  }, {});
  const breakdown = ['blocker', 'warning', 'suggestion'].filter((severity) => counts[severity]).map((severity) => `${counts[severity]} ${severity}${counts[severity] === 1 ? '' : 's'}`).join(' · ') || 'No actionable findings';
  const link = `https://github.com/${context.owner}/${context.repo}/pull/${context.number}`;
  return `*Context review completed*\n<${link}|${context.owner}/${context.repo} #${context.number}> — ${review.risk} risk\n${review.findings.length} finding${review.findings.length === 1 ? '' : 's'}: ${breakdown}\n\n${review.summary}`;
}

async function publishSlackNotification(context, review) {
  const providerConfigKey = process.env.NANGO_SLACK_CONFIG_KEY;
  const connectionId = getSourceConnectionId('SLACK');
  const channel = process.env.SLACK_CHANNEL_ID;
  if (process.env.POST_SLACK_NOTIFICATION !== 'true' || context.mode !== 'live' || !providerConfigKey || !connectionId || !channel) return false;
  const response = await nangoRequest({
    providerConfigKey,
    connectionId,
    apiPath: '/chat.postMessage',
    method: 'POST',
    body: { channel, text: slackReviewText(context, review) }
  });
  if (response?.ok === false) throw new Error(`Slack ${response.error || 'message failed'}`);
  return true;
}

async function buildReview(payload) {
  const pr = payload.pullRequest || payload;
  const connectionId = getConnectionId(payload);
  let notionIds = findNotionIds(pr.body || '');
  let github = { pullRequest: pr, comments: [], files: [] };
  let notion = [];

  if (process.env.NANGO_SECRET_KEY && connectionId) {
    github = await fetchGithubContext(pr, connectionId);
    notionIds = findNotionIds(`${github.pullRequest?.body || ''}\n${pr.body || ''}`);
    notion = await fetchNotionContext(notionIds, getSourceConnectionId('NOTION'));
  }

  const context = {
    owner: pr.owner || payload.owner,
    repo: pr.repo || payload.repo,
    number: pr.number,
    connectionId,
    pullRequest: github.pullRequest,
    comments: github.comments,
    files: github.files,
    filesCount: github.files.length || pr.changed_files || 0,
    diff: serializeFiles(github.files),
    notion,
    mode: process.env.OPENAI_API_KEY ? 'live' : 'demo'
  };
  const generated = await generateReview(context);
  context.mode = generated.mode;
  const shouldPublish = payload.publish === true || process.env.POST_REVIEW_COMMENT === 'true';
  const commentPosted = await publishGithubComment(context, generated.review, shouldPublish, payload.actor);
  let slackNotificationPosted = false;
  if (commentPosted) {
    try {
      slackNotificationPosted = await publishSlackNotification(context, generated.review);
    } catch (error) {
      console.error(`Slack notification failed: ${error.message}`);
    }
  }
  return {
    id: `${context.owner}/${context.repo}#${context.number}`,
    pullRequest: { owner: context.owner, repo: context.repo, number: context.number, title: context.pullRequest.title },
    review: generated.review,
    brief: { intro: generated.review.summary, sections: generated.review.walkthrough.map((body, index) => ({ title: `Step ${index + 1}`, body })) },
    findings: generated.review.findings,
    sources: { github: true, notion: notion.length, comments: github.comments.length },
    mode: generated.mode,
    commentPosted,
    slackNotificationPosted,
    createdAt: new Date().toISOString()
  };
}

async function handleReviewRequest(request, response) {
  const payload = parseJsonBody(await readBody(request));
  const review = await buildReview({
    ...payload,
    publish: payload.publish === true,
    pullRequest: payload.pullRequest || {
      ...demoPullRequest,
      owner: payload.owner || demoPullRequest.owner,
      repo: payload.repo || demoPullRequest.repo,
      number: payload.number || demoPullRequest.number
    }
  });
  reviews.set(review.id, review);
  sendJson(response, 200, review);
}

async function handleGithubChatCommand(payload, response) {
  const comment = payload.comment || {};
  const commandMatch = String(comment.body || '').match(/(?:^|\s)(?:\/context|@context)(?:\s+(review|check|suggest))?/i);
  if (payload.action !== 'created' || comment.user?.type === 'Bot' || !commandMatch || !payload.issue?.pull_request) {
    sendJson(response, 202, { accepted: true, ignored: true, reason: 'Not a Context command' });
    return;
  }
  const repository = payload.repository || {};
  const pullRequest = {
    owner: repository.owner?.login || repository.owner?.name,
    repo: repository.name,
    number: payload.issue.number,
    title: payload.issue.title,
    body: payload.issue.body || comment.body
  };
  const review = await buildReview({
    ...payload,
    actor: comment.user.login,
    publish: true,
    connectionId: getConnectionId(payload),
    pullRequest
  });
  reviews.set(review.id, review);
  sendJson(response, 202, { accepted: true, reviewId: review.id, mode: review.mode, commentPosted: review.commentPosted });
}

async function handleGithubWebhook(request, response) {
  const rawBody = await readBody(request);
  if (!verifyGithubSignature(rawBody, request.headers['x-hub-signature-256'])) {
    sendJson(response, 401, { error: 'Invalid GitHub webhook signature' });
    return;
  }
  const payload = parseJsonBody(rawBody);
  const githubEvent = request.headers['x-github-event'] || 'pull_request';
  if (githubEvent === 'issue_comment') {
    await handleGithubChatCommand(payload, response);
    return;
  }
  if (githubEvent !== 'pull_request') {
    sendJson(response, 202, { accepted: true, ignored: true, event: githubEvent });
    return;
  }
  const action = payload.action;
  const supported = ['opened', 'reopened', 'synchronize'].includes(action) && payload.pull_request;
  if (!supported) {
    sendJson(response, 202, { accepted: true, ignored: true, action });
    return;
  }
  const pullRequest = payload.pull_request;
  const repository = payload.repository || {};
  const review = await buildReview({
    ...payload,
    publish: process.env.POST_REVIEW_COMMENT === 'true',
    actor: pullRequest.user?.login,
    connectionId: getConnectionId(payload),
    pullRequest: {
      ...pullRequest,
      owner: repository.owner?.login || repository.owner?.name,
      repo: repository.name
    }
  });
  reviews.set(review.id, review);
  sendJson(response, 202, { accepted: true, reviewId: review.id, mode: review.mode, commentPosted: review.commentPosted });
}

function serveStatic(request, response) {
  const requested = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const safePath = requested === '/' ? '/index.html' : requested;
  const filePath = path.resolve(ROOT, `.${safePath}`);
  if (!filePath.startsWith(ROOT)) return sendText(response, 403, 'Forbidden', 'text/plain');
  fs.readFile(filePath, (error, file) => {
    if (error) return sendText(response, 404, 'Not found', 'text/plain');
    const extension = path.extname(filePath);
    const contentType = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' }[extension] || 'application/octet-stream';
    sendText(response, 200, file, contentType);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Hub-Signature-256' });
      response.end();
      return;
    }
    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, { ok: true, nangoConfigured: Boolean(process.env.NANGO_SECRET_KEY), llmConfigured: Boolean(process.env.OPENAI_API_KEY) });
      return;
    }
    if (request.method === 'GET' && request.url === '/api/review-brief/latest') {
      sendJson(response, 200, [...reviews.values()].at(-1) || null);
      return;
    }
    if (request.method === 'POST' && (request.url === '/api/review' || request.url === '/api/review-brief')) {
      await handleReviewRequest(request, response);
      return;
    }
    if (request.method === 'POST' && request.url === '/webhooks/github') {
      await handleGithubWebhook(request, response);
      return;
    }
    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
      sendText(response, 200, 'Context PR bot is running. Configure a GitHub webhook for /webhooks/github.\n', 'text/plain; charset=utf-8');
      return;
    }
    if (request.method === 'GET') {
      serveStatic(request, response);
      return;
    }
    sendJson(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Context PR bot listening at http://localhost:${PORT}`);
});
