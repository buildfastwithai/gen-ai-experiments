import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function loadDotEnv() {
  const envPath = path.join(import.meta.dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const COMPOSIO_API_URL = 'https://backend.composio.dev/api/v3.1';
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const USER_ID = process.env.COMPOSIO_USER_ID || 'user_123';
const WORKSPACE_NAME = process.env.DASHBOARD_WORKSPACE_NAME || '';
const USER_DISPLAY_NAME = process.env.DASHBOARD_USER_NAME || process.env.SALES_REP_NAME || '';
const SALES_PROFILE = {
  name: process.env.SALES_REP_NAME || '',
  title: process.env.SALES_REP_TITLE || '',
  company: process.env.SALES_REP_COMPANY || '',
  phone: process.env.SALES_REP_PHONE || '',
  email: process.env.SALES_REP_EMAIL || ''
};
const CRM_PROVIDER = process.env.CRM_PROVIDER || 'hubspot';
const COLD_LEAD_DAYS = Number(process.env.COLD_LEAD_DAYS || 14);
const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const AUTH_CONFIG_IDS = {
  gmail: process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID || '',
  zoho: process.env.COMPOSIO_ZOHO_AUTH_CONFIG_ID || '',
  googlecalendar: process.env.COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID || '',
  slack: process.env.COMPOSIO_SLACK_AUTH_CONFIG_ID || ''
};
let latestRun = null;
let activityLog = [];

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, status, body, contentType) {
  response.writeHead(status, { 'Content-Type': contentType });
  response.end(body);
}

function serveStatic(request, response) {
  const requestPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }
  fs.readFile(filePath, (error, file) => {
    if (error) {
      sendText(response, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }
    const contentType = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[path.extname(filePath)] || 'application/octet-stream';
    sendText(response, 200, file, contentType);
  });
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) { request.destroy(); reject(new Error('Body too large')); }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw new Error('Invalid JSON'); }
}

async function composioRequest(endpoint, options = {}) {
  if (!COMPOSIO_API_KEY) throw new Error('COMPOSIO_API_KEY is not configured');
  const url = endpoint.startsWith('http') ? endpoint : `${COMPOSIO_API_URL}${endpoint}`;
  const result = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'x-api-key': COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await result.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!result.ok) {
    throw new Error(`Composio ${result.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function composioExecuteTool(toolSlug, arguments_ = {}) {
  const response = await composioRequest(`/tools/execute/${toolSlug}`, {
    method: 'POST',
    body: {
      user_id: USER_ID,
      arguments: arguments_,
      version: 'latest'
    }
  });
  return response;
}

async function composioSearchTools(query, toolkits = []) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (toolkits.length) params.set('toolkit_slug', toolkits[0]);
  params.set('limit', '20');
  const response = await composioRequest(`/tools?${params.toString()}`);
  return response?.items || response || [];
}

async function createConnectionLink(toolkit) {
  const authConfigId = AUTH_CONFIG_IDS[toolkit];
  if (!authConfigId) throw new Error(`Missing COMPOSIO_${toolkit.toUpperCase()}_AUTH_CONFIG_ID`);
  return composioRequest('/connected_accounts/link', {
    method: 'POST',
    body: {
      auth_config_id: authConfigId,
      user_id: USER_ID,
      alias: `${toolkit}-${USER_ID}`,
      callback_url: `http://localhost:${PORT}/auth/callback`
    }
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function openaiChat(messages, tools = null) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const body = {
    model: LLM_MODEL,
    temperature: 0.3,
    messages
  };
  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  const result = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!result.ok) throw new Error(`OpenAI ${result.status}: ${await result.text()}`);
  return result.json();
}

async function openaiJsonResponse(systemPrompt, userContent) {
  const result = await openaiChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ]);
  const content = result.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); } catch { return JSON.parse(content.replace(/```json\n?/g, '').replace(/```/g, '')); }
}

async function fetchGmailEmails(daysBack = 30) {
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const sinceStamp = Math.floor(sinceDate.getTime() / 1000);

  try {
    const response = await composioExecuteTool('GMAIL_FETCH_EMAILS', {
      max_results: 50,
      query: `after:${sinceStamp}`
    });
    const data = response?.data || response;
    return Array.isArray(data) ? data : (data?.emails || data?.messages || []);
  } catch (error) {
    console.error(`Gmail fetch failed: ${error.message}`);
    return [];
  }
}

async function fetchGmailThread(threadId) {
  try {
    const response = await composioExecuteTool('GMAIL_GET_THREAD', { thread_id: threadId });
    return response?.data || response;
  } catch (error) {
    console.error(`Gmail thread fetch failed: ${error.message}`);
    return null;
  }
}

async function fetchCRMContacts() {
  const toolSlug = CRM_PROVIDER === 'zoho'
    ? 'ZOHO_LIST_LEADS'
    : 'HUBSPOT_LIST_CONTACTS';

  try {
    const response = await composioExecuteTool(toolSlug, CRM_PROVIDER === 'zoho'
      ? { fields: 'First_Name,Last_Name,Email,Company,Lead_Status,Description,Created_Time,Modified_Time', per_page: 100 }
      : { limit: 100 });
    const data = response?.data || response;
    return Array.isArray(data) ? data : (data?.data || data?.results || data?.contacts || []);
  } catch (error) {
    console.error(`CRM contact fetch failed: ${error.message}`);
    return [];
  }
}

async function updateCRMContact(contactId, properties) {
  const toolSlug = CRM_PROVIDER === 'zoho'
    ? 'ZOHO_UPDATE_LEAD'
    : 'HUBSPOT_UPDATE_CONTACT';

  try {
    const response = await composioExecuteTool(toolSlug, {
      ...(CRM_PROVIDER === 'hubspot' ? { contact_id: contactId, properties } : { data: [{ id: contactId, Lead_Status: 'Followed Up', Description: properties.notes }] })
    });
    return response?.data || response;
  } catch (error) {
    console.error(`CRM update failed for ${contactId}: ${error.message}`);
    return null;
  }
}

async function fetchCalendarEvents(daysBack = 30) {
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const timeMin = sinceDate.toISOString();

  try {
    const response = await composioExecuteTool('GOOGLECALENDAR_EVENTS_LIST', {
      timeMin,
      maxResults: 50,
      calendarId: 'primary',
      singleEvents: true,
      orderBy: 'startTime'
    });
    const data = response?.data || response;
    return Array.isArray(data) ? data : (data?.items || data?.events || []);
  } catch (error) {
    console.error(`Calendar fetch failed: ${error.message}`);
    return [];
  }
}

async function sendSlackNotification(message) {
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!channelId) return false;

  try {
    const response = await composioExecuteTool('SLACK_CHAT_POST_MESSAGE', {
      channel: channelId,
      markdown_text: message
    });
    return response?.data?.ok ?? response?.successful ?? Boolean(response?.data);
  } catch (error) {
    console.error(`Slack notification failed: ${error.message}`);
    return false;
  }
}

async function sendGmailReply(to, subject, body) {
  try {
    const response = await composioExecuteTool('GMAIL_SEND_EMAIL', {
      recipient_email: to,
      subject,
      body,
      is_html: false
    });
    if (response?.successful === false || response?.error || response?.data?.error) {
      throw new Error(response.error || response.data.error || 'Gmail rejected the message');
    }
    return response?.data || response;
  } catch (error) {
    console.error(`Gmail send failed: ${error.message}`);
    return null;
  }
}

function getContactEmail(contact) {
  return String(contact.email || contact.Email || contact.properties?.email || contact.properties?.Email || '').trim().toLowerCase();
}

function collectDateValues(value, key = '', dates = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDateValues(item, key, dates));
    return dates;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /date|time|timestamp|sent|received|created|updated/i.test(key)) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) dates.push(new Date(parsed));
    }
    if (typeof value === 'number' && /date|time|timestamp|sent|received|created|updated/i.test(key)) {
      const parsed = new Date(value < 10_000_000_000 ? value * 1000 : value);
      if (!Number.isNaN(parsed.getTime())) dates.push(parsed);
    }
    return dates;
  }
  Object.entries(value).forEach(([childKey, childValue]) => collectDateValues(childValue, childKey, dates));
  return dates;
}

function getEmailDate(email) {
  const dates = collectDateValues(email).sort((a, b) => b.getTime() - a.getTime());
  return dates[0] || null;
}

function buildColdLeadCandidates(emails, contacts) {
  const coldThreshold = Date.now() - COLD_LEAD_DAYS * 24 * 60 * 60 * 1000;
  return contacts.map((contact) => {
    const email = getContactEmail(contact);
    if (!email) return null;
    const matchingEmails = emails.filter((message) => JSON.stringify(message).toLowerCase().includes(email));
    if (!matchingEmails.length) return null;
    const lastContactDate = matchingEmails.map(getEmailDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null;
    if (lastContactDate && lastContactDate.getTime() > coldThreshold && COLD_LEAD_DAYS > 0) return null;
    return {
      email,
      name: contact.name || contact.Full_Name || [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ') || contact.properties?.firstname || 'Unknown lead',
      company: contact.company || contact.Company || contact.properties?.company || '',
      lastContactDate: lastContactDate?.toISOString() || null,
      messages: matchingEmails.slice(0, 5)
    };
  }).filter(Boolean);
}

async function analyzeColdLeads(candidates, calendarEvents) {
  const systemPrompt = `You are a sales intelligence analyst. Given matched CRM leads, their email history, and calendar events, identify leads that have gone cold (no meaningful communication in the last ${COLD_LEAD_DAYS} days). For each cold lead, return a JSON object with: email, name, lastContactDate, reasonCold, followUpDraft (a personalized email), priority (high/medium/low), and suggestedAction. Use the sender profile in every draft. Never output placeholders such as [Your Name], [Company], [Your Position], [Your Phone Number], or [Your Email]. If a profile value is empty, omit that signature line instead. Return a JSON array. If no leads are cold, return an empty array.`;
  const userContent = `SENDER PROFILE:\n${JSON.stringify(SALES_PROFILE)}\n\nMATCHED COLD-LEAD CANDIDATES:\n${JSON.stringify(candidates).slice(0, 16000)}\n\nCALENDAR EVENTS:\n${JSON.stringify(calendarEvents.slice(0, 20)).slice(0, 3000)}`;
  return openaiJsonResponse(systemPrompt, userContent);
}

async function runAgent(daysBack = 30, executeActions = false) {
  console.log('Starting AI Sales Follow-Up Agent...');
  console.log(`User ID: ${USER_ID}`);
  console.log(`CRM Provider: ${CRM_PROVIDER}`);
  console.log(`Cold lead threshold: ${COLD_LEAD_DAYS} days`);
  console.log(`Mode: ${executeActions ? 'execute actions' : 'analysis only'}`);
  console.log('');

  console.log('1. Fetching emails from Gmail...');
  const emails = await fetchGmailEmails(daysBack);
  console.log(`   Found ${emails.length} emails`);

  console.log('2. Fetching contacts from CRM...');
  const contacts = await fetchCRMContacts();
  console.log(`   Found ${contacts.length} contacts`);

  console.log('3. Fetching calendar events...');
  const calendarEvents = await fetchCalendarEvents(daysBack);
  console.log(`   Found ${calendarEvents.length} events`);

  const candidates = buildColdLeadCandidates(emails, contacts);
  console.log(`   Matched ${candidates.length} CRM leads to Gmail history`);

  console.log('4. Analyzing cold leads with OpenAI...');
  const analysis = await analyzeColdLeads(candidates, calendarEvents);
  const coldLeads = Array.isArray(analysis) ? analysis : (analysis?.coldLeads || []);

  console.log(`   Identified ${coldLeads.length} cold leads`);
  console.log('');

  const results = [];

  for (const lead of coldLeads) {
    console.log(`Processing: ${lead.name || lead.email} (Priority: ${lead.priority || 'medium'})`);

    let emailSent = false;
    let crmUpdated = false;
    let slackSent = false;

    if (executeActions && lead.followUpDraft && lead.email) {
      console.log(`   -> Drafting follow-up email`);
      const emailResult = await sendGmailReply(
        lead.email,
        `Following up - ${lead.name || 'there'}`,
        lead.followUpDraft
      );
      emailSent = Boolean(emailResult);
    }

    const matchingContact = contacts.find(
      (c) => c.email === lead.email || c.Email === lead.email || c.properties?.email === lead.email || c.properties?.Email === lead.email
    );
    const contactCompany = matchingContact?.company || matchingContact?.Company || matchingContact?.properties?.company || matchingContact?.data?.Company || '';

    if (executeActions && matchingContact) {
      const contactId = matchingContact.id || matchingContact.contact_id;
      if (contactId) {
        console.log(`   -> Updating CRM`);
        const updateResult = await updateCRMContact(contactId, {
          last_follow_up_date: new Date().toISOString(),
          lead_status: 'followed_up',
          notes: `AI Agent: ${lead.reasonCold || 'Cold lead follow-up'}`
        });
        crmUpdated = Boolean(updateResult);
      }
    }

    const slackMessage = [
      `*Cold Lead Alert*`,
      `*Lead:* ${lead.name || lead.email}`,
      `*Priority:* ${lead.priority || 'medium'}`,
      `*Reason cold:* ${lead.reasonCold || 'No recent communication'}`,
      `*Suggested action:* ${lead.suggestedAction || 'Send follow-up email'}`,
      lead.followUpDraft ? `*Draft follow-up:* ${lead.followUpDraft.slice(0, 200)}...` : ''
    ].filter(Boolean).join('\n');

    if (executeActions) slackSent = await sendSlackNotification(slackMessage);

    results.push({
      lead: { name: lead.name || matchingContact?.Full_Name, email: lead.email, company: lead.company || contactCompany, priority: lead.priority, lastContactDate: lead.lastContactDate },
      reasonCold: lead.reasonCold,
      suggestedAction: lead.suggestedAction,
      emailSent,
      crmUpdated,
      slackSent,
      followUpDraft: lead.followUpDraft
    });

    console.log(`   -> Email sent: ${emailSent}`);
    console.log(`   -> CRM updated: ${crmUpdated}`);
    console.log(`   -> Slack notified: ${slackSent}`);
    console.log('');
  }

  console.log('Agent run complete.');
  console.log(`Total cold leads: ${coldLeads.length}`);
  console.log(`Emails sent: ${results.filter((r) => r.emailSent).length}`);
  console.log(`CRM updates: ${results.filter((r) => r.crmUpdated).length}`);
  console.log(`Slack notifications: ${results.filter((r) => r.slackSent).length}`);

  const allLeads = contacts.map((contact) => ({
    id: contact.id || contact.lead_id || contact.contact_id,
    name: contact.name || contact.Full_Name || [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ') || contact.properties?.firstname || 'Unnamed lead',
    email: getContactEmail(contact),
    company: contact.company || contact.Company || contact.properties?.company || contact.data?.Company || 'Company not provided',
    status: contact.Lead_Status || contact.lead_status || contact.properties?.lead_status || 'Unknown'
  }));

  latestRun = {
    completedAt: new Date().toISOString(),
    summary: {
      totalEmails: emails.length,
      totalContacts: contacts.length,
      totalCalendarEvents: calendarEvents.length,
      coldLeadsFound: coldLeads.length,
      emailsSent: results.filter((r) => r.emailSent).length,
      crmUpdates: results.filter((r) => r.crmUpdated).length,
      slackNotifications: results.filter((r) => r.slackSent).length
    },
    executionMode: executeActions ? 'executed' : 'analysis-only',
    coldLeads: results,
    allLeads
  };
  activityLog = [
    { title: `${coldLeads.length} cold leads identified`, detail: `Matched ${emails.length} Gmail messages to ${contacts.length} CRM leads`, time: latestRun.completedAt },
    ...results.map((result) => ({ title: result.emailSent ? `Follow-up sent to ${result.lead.name}` : `Follow-up draft ready for ${result.lead.name}`, detail: result.emailSent ? 'Delivered through Gmail' : 'Waiting for approval', time: latestRun.completedAt })),
    ...results.filter((result) => result.crmUpdated).map((result) => ({ title: `CRM lead updated for ${result.lead.name}`, detail: `Status changed in ${CRM_PROVIDER}`, time: latestRun.completedAt })),
    ...results.filter((result) => result.slackSent).map((result) => ({ title: 'Slack notification delivered', detail: 'Sales channel notified', time: latestRun.completedAt }))
  ];
  return latestRun;
}

function normalizeCRMLead(contact) {
  return {
    id: contact.id || contact.lead_id || contact.contact_id,
    name: contact.name || contact.Full_Name || [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ') || contact.properties?.firstname || 'Unnamed lead',
    email: getContactEmail(contact),
    company: contact.company || contact.Company || contact.properties?.company || contact.data?.Company || 'Company not provided',
    status: contact.Lead_Status || contact.lead_status || contact.properties?.lead_status || 'Unknown'
  };
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        composioConfigured: Boolean(COMPOSIO_API_KEY),
        openaiConfigured: Boolean(OPENAI_API_KEY),
        crmProvider: CRM_PROVIDER,
        userId: USER_ID
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/dashboard') {
      sendJson(response, 200, {
        userId: USER_ID,
        workspaceName: WORKSPACE_NAME || USER_ID,
        displayName: USER_DISPLAY_NAME || USER_ID,
        crmProvider: CRM_PROVIDER,
        coldLeadDays: COLD_LEAD_DAYS,
        run: latestRun,
        connections: {
          gmail: Boolean(latestRun?.summary?.totalEmails),
          zoho: CRM_PROVIDER === 'zoho' && Boolean(latestRun?.summary?.totalContacts),
          calendar: Boolean(latestRun),
          slack: Boolean(latestRun?.summary?.slackNotifications)
        }
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/leads') {
      const contacts = await fetchCRMContacts();
      sendJson(response, 200, { leads: contacts.map(normalizeCRMLead) });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/activity') {
      sendJson(response, 200, { activity: activityLog });
      return;
    }

    if (request.method === 'GET' && request.url.startsWith('/api/tools/search')) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const query = url.searchParams.get('q') || '';
      const toolkits = url.searchParams.get('toolkits')?.split(',') || [];
      const tools = await composioSearchTools(query, toolkits);
      sendJson(response, 200, { tools });
      return;
    }

    if (request.method === 'GET' && request.url.startsWith('/api/connect/')) {
      const toolkit = request.url.split('/').pop().toLowerCase();
      if (!Object.hasOwn(AUTH_CONFIG_IDS, toolkit)) {
        sendJson(response, 400, { error: 'Supported toolkits: gmail, zoho, googlecalendar, slack' });
        return;
      }
      const link = await createConnectionLink(toolkit);
      sendText(response, 200, `<h1>Connect ${escapeHtml(toolkit)}</h1><p>Authorize this account for <strong>${escapeHtml(USER_ID)}</strong>.</p><p><a href="${escapeHtml(link.redirect_url)}">Open Composio authorization</a></p><p>This link expires at ${escapeHtml(link.expires_at || 'the expiry shown by Composio')}.</p>`, 'text/html; charset=utf-8');
      return;
    }

    if (request.method === 'GET' && request.url.startsWith('/auth/callback')) {
      const callbackUrl = new URL(request.url, `http://${request.headers.host}`);
      const status = callbackUrl.searchParams.get('status') || 'unknown';
      const connectedAccountId = callbackUrl.searchParams.get('connected_account_id') || '';
      sendText(response, 200, `Composio connection ${status}. Connected account: ${connectedAccountId || 'check the dashboard'}. You can close this tab.\n`, 'text/plain; charset=utf-8');
      return;
    }

    if (request.method === 'POST' && request.url === '/api/execute') {
      const payload = parseJson(await readBody(request));
      if (!payload.tool) {
        sendJson(response, 400, { error: 'Tool slug is required' });
        return;
      }
      const result = await composioExecuteTool(payload.tool, payload.arguments || {});
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/analyze-leads') {
      const payload = parseJson(await readBody(request));
      const daysBack = payload.daysBack || 30;
      const result = await runAgent(daysBack, payload.executeActions === true);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/draft-followup') {
      const payload = parseJson(await readBody(request));
      const systemPrompt = 'Draft a professional, concise follow-up email for a cold sales lead. Use the sender profile. Never output placeholders such as [Your Name], [Your Position], [Your Company], [Your Phone Number], or [Your Email]. Omit missing signature fields instead. Return JSON with subject, body, and suggestedAction.';
      const userContent = `SENDER PROFILE: ${JSON.stringify(SALES_PROFILE)}\nLead name: ${payload.name || 'there'}\nLead email: ${payload.email}\nReason cold: ${payload.reasonCold || 'No response'}\nPrevious context: ${payload.context || 'None'}`;
      const draft = await openaiJsonResponse(systemPrompt, userContent);
      sendJson(response, 200, draft);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/send-followup') {
      const payload = parseJson(await readBody(request));
      if (!payload.to || !payload.body) {
        sendJson(response, 400, { error: 'Recipient and email body are required' });
        return;
      }
      const sent = await sendGmailReply(payload.to, payload.subject || 'Following up', payload.body);
      if (!sent) {
        sendJson(response, 502, { error: 'Gmail could not send the follow-up' });
        return;
      }
      sendJson(response, 200, { sent: true });
      return;
    }

    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html' || request.url === '/styles.css' || request.url === '/overrides.css' || request.url === '/app.js')) {
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
  console.log(`AI Sales Follow-Up Agent listening at http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /api/health          - Check configuration');
  console.log('  POST /api/analyze-leads   - Run the full agent');
  console.log('  POST /api/draft-followup  - Draft a single follow-up email');
  console.log('  POST /api/execute         - Execute any Composio tool directly');
  console.log('  GET  /api/tools/search    - Search available Composio tools');
  console.log('');
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
