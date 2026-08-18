const runButton = document.querySelector('#run-agent');
const draftButton = document.querySelector('#draft-button');
const toast = document.querySelector('#toast');
const toastText = document.querySelector('#toast-text');
const metricCards = [...document.querySelectorAll('.metric')];
const leadList = document.querySelector('#lead-list');
const timeline = document.querySelector('.timeline');
const insightQuote = document.querySelector('.insight-card blockquote');
const insightMeta = document.querySelector('.insight-footer span');
const connectionItems = [...document.querySelectorAll('.connection-grid > div')];
const leadModal = document.querySelector('#lead-modal');
const sendDraftButton = document.querySelector('#send-draft');
const allLeadsModal = document.querySelector('#all-leads-modal');
const allLeadsList = document.querySelector('#all-leads-list');
const allLeadsCount = document.querySelector('#all-leads-count');
const leadSearch = document.querySelector('#lead-search');
const activityModal = document.querySelector('#activity-modal');
const activityLogList = document.querySelector('#activity-log-list');
const themeToggle = document.querySelector('#theme-toggle');
let selectedDraft = null;
let toastTimer;
let dashboardState;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function showToast(message) {
  toastText.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3800);
}

function setLoading(isLoading) {
  runButton.disabled = isLoading;
  runButton.querySelector('b').textContent = isLoading ? 'Analyzing pipeline...' : 'Analyze pipeline';
  runButton.querySelector('small').textContent = isLoading ? 'Reading your pipeline' : 'Draft actions, send nothing';
}

function setMetric(index, value, footnote) {
  const card = metricCards[index];
  if (!card) return;
  card.querySelector('strong').textContent = value;
  card.querySelector('.metric-bottom span').textContent = footnote;
}

function renderConnections(connections, run) {
  const states = [connections.gmail, connections.zoho, connections.calendar, connections.slack];
  connectionItems.forEach((item, index) => {
    const state = item.querySelector('small');
    if (state) state.textContent = states[index] ? 'Connected' : 'Not verified in latest run';
  });
  const slackTimeline = run?.summary?.slackNotifications ? 'Slack notification delivered' : 'Slack notification not sent';
  return slackTimeline;
}

async function openLeadReview(lead) {
  selectedDraft = null;
  leadModal.classList.add('open');
  leadModal.setAttribute('aria-hidden', 'false');
  const initials = (lead.name || lead.email || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  document.querySelector('#modal-avatar').textContent = initials;
  document.querySelector('#modal-lead-name').textContent = lead.name || lead.email || 'Lead review';
  document.querySelector('#modal-lead-email').textContent = lead.email || 'No email available';
  document.querySelector('#modal-priority').textContent = lead.priority || 'medium';
  document.querySelector('#modal-reason').textContent = lead.reasonCold || 'No recent communication';
  document.querySelector('#modal-action').textContent = lead.suggestedAction || 'Send a personalized follow-up';
  document.querySelector('#draft-status').textContent = 'Generating...';
  document.querySelector('#draft-subject').value = 'Preparing draft...';
  document.querySelector('#draft-body').value = 'Signal is reading the lead context and composing a personalized follow-up.';
  sendDraftButton.disabled = true;
  try {
    const response = await fetch('/api/draft-followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
    if (!response.ok) throw new Error('Draft request failed');
    const draft = await response.json();
    selectedDraft = { ...lead, subject: draft.subject || `Following up - ${lead.name || 'there'}`, body: draft.body || '' };
    document.querySelector('#draft-status').textContent = 'Ready to send';
    document.querySelector('#draft-subject').value = selectedDraft.subject;
    document.querySelector('#draft-body').value = selectedDraft.body;
    sendDraftButton.disabled = false;
  } catch (error) {
    document.querySelector('#draft-status').textContent = 'Unavailable';
    document.querySelector('#draft-body').value = error.message;
  }
}

function closeLeadReview() {
  leadModal.classList.remove('open');
  leadModal.setAttribute('aria-hidden', 'true');
}

function renderLeads(leads) {
  if (!leads.length) {
    leadList.innerHTML = '<div class="empty-state">No cold leads in the latest run. Run the agent to refresh this queue.</div>';
    return;
  }
  leadList.innerHTML = leads.map((item) => {
    const lead = item.lead || {};
    const initials = escapeHtml((lead.name || lead.email || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase());
    const priority = escapeHtml(lead.priority || 'medium');
    const reason = escapeHtml(item.reasonCold || 'No recent communication');
    const lastContact = lead.lastContactDate ? new Date(lead.lastContactDate).toLocaleDateString() : 'Unknown';
    return `<div class="lead-row"><div class="lead-avatar lavender">${initials}</div><div class="lead-main"><div class="lead-title"><b>${escapeHtml(lead.name || lead.email)}</b><span class="priority ${priority}">${priority}</span></div><span class="company">${escapeHtml(lead.company || 'Company not provided')} <i>·</i> ${escapeHtml(lead.email || 'Email not provided')} <i>·</i> Last contact ${escapeHtml(lastContact)}</span></div><div class="lead-reason"><small>Why it went cold</small><span>${reason}</span></div><button class="lead-action" data-lead="${escapeHtml(JSON.stringify({ name: lead.name, email: lead.email, reasonCold: item.reasonCold }))}">Review <span>→</span></button></div>`;
  }).join('');
  leadList.querySelectorAll('.lead-action').forEach((button) => {
    button.addEventListener('click', async () => {
      const lead = JSON.parse(button.dataset.lead);
      await openLeadReview(lead);
    });
  });
}

function renderAllLeads(leads, query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = leads.filter((lead) => `${lead.name} ${lead.email} ${lead.company}`.toLowerCase().includes(normalizedQuery));
  allLeadsCount.textContent = `${filtered.length} of ${leads.length} CRM leads`;
  if (!filtered.length) {
    allLeadsList.innerHTML = '<div class="empty-state">No matching leads.</div>';
    return;
  }
  allLeadsList.innerHTML = filtered.map((lead) => {
    const initials = (lead.name || lead.email || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    const reviewData = { name: lead.name, email: lead.email, reasonCold: `Current CRM status: ${lead.status || 'Unknown'}` };
    return `<div class="directory-row"><div class="directory-avatar">${escapeHtml(initials)}</div><div class="directory-main"><b>${escapeHtml(lead.name)}</b><small>${escapeHtml(lead.email || 'No email')} · ${escapeHtml(lead.company || 'Company not provided')}</small></div><span class="directory-status">${escapeHtml(lead.status || 'Unknown')}</span><button class="directory-review" data-lead="${escapeHtml(JSON.stringify(reviewData))}">Review <span>→</span></button></div>`;
  }).join('');
  allLeadsList.querySelectorAll('.directory-review').forEach((button) => button.addEventListener('click', () => {
    closeAllLeads();
    openLeadReview(JSON.parse(button.dataset.lead));
  }));
}

async function openAllLeads() {
  allLeadsModal.classList.add('open');
  allLeadsModal.setAttribute('aria-hidden', 'false');
  allLeadsList.innerHTML = '<div class="empty-state">Loading CRM leads...</div>';
  try {
    const response = await fetch('/api/leads');
    if (!response.ok) throw new Error('CRM leads unavailable');
    const result = await response.json();
    renderAllLeads(result.leads || [], leadSearch.value);
  } catch (error) {
    renderAllLeads(dashboardState?.run?.allLeads || [], leadSearch.value);
    if (!dashboardState?.run?.allLeads?.length) showToast(error.message);
  }
}

function closeAllLeads() {
  allLeadsModal.classList.remove('open');
  allLeadsModal.setAttribute('aria-hidden', 'true');
}

function renderActivityLog(activity) {
  if (!activity.length) {
    activityLogList.innerHTML = '<div class="empty-state">No activity yet. Run the agent to create a log.</div>';
    return;
  }
  activityLogList.innerHTML = activity.map((item) => `<div class="directory-row"><div class="directory-avatar">✦</div><div class="directory-main"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></div><span class="directory-status">${escapeHtml(new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span></div>`).join('');
}

async function openActivityLog() {
  activityModal.classList.add('open');
  activityModal.setAttribute('aria-hidden', 'false');
  activityLogList.innerHTML = '<div class="empty-state">Loading activity...</div>';
  try {
    const response = await fetch('/api/activity');
    if (!response.ok) throw new Error('Activity unavailable');
    renderActivityLog((await response.json()).activity || []);
  } catch (error) {
    activityLogList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function closeActivityLog() {
  activityModal.classList.remove('open');
  activityModal.setAttribute('aria-hidden', 'true');
}

function renderTimeline(run) {
  if (!run) {
    timeline.innerHTML = '<div class="empty-state">No agent run yet. Your first run will appear here.</div>';
    return;
  }
  const completedAt = new Date(run.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const executed = run.executionMode === 'executed';
  const activity = [
    [`${run.summary.coldLeadsFound} cold leads identified`, `Matched ${run.summary.totalEmails} Gmail messages to ${run.summary.totalContacts} CRM leads`, 'sparkle'],
    [executed ? `${run.summary.emailsSent} follow-ups sent` : `${run.summary.coldLeadsFound} follow-up drafts ready`, executed ? 'Personalized drafts delivered through Gmail' : 'Review and send individually', 'mail'],
    [`${run.summary.crmUpdates} CRM records updated`, `Status changed in ${dashboardState.crmProvider}`, 'crm'],
    [run.summary.slackNotifications ? 'Slack notification delivered' : 'Slack notification not sent', run.summary.slackNotifications ? 'Sales channel notified' : 'Add a channel ID to enable alerts', 'check']
  ];
  timeline.innerHTML = activity.map(([title, detail, icon]) => `<div class="timeline-item"><span class="timeline-icon ${icon}">${icon === 'sparkle' ? '✦' : icon === 'mail' ? '↗' : icon === 'crm' ? 'Z' : '✓'}</span><div><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></div><time>${completedAt}</time></div>`).join('');
}

function renderDashboard(data) {
  dashboardState = data;
  const run = data.run;
  const summary = run?.summary || {};
  const displayName = data.displayName || data.userId || 'User';
  const workspaceName = data.workspaceName || data.userId || 'Workspace';
  const initials = displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  document.querySelector('.workspace b').textContent = workspaceName;
  document.querySelector('.workspace-avatar').textContent = initials || 'WS';
  document.querySelector('.profile b').textContent = displayName;
  document.querySelector('.profile-avatar').textContent = initials || '--';
  document.querySelector('.top-avatar').textContent = initials || '--';
  document.querySelector('#current-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  document.querySelector('.nav-badge').textContent = run ? summary.totalContacts : '--';
  document.querySelector('.filter-button').firstChild.textContent = data.coldLeadDays === 0 ? 'Demo window ' : `Last ${data.coldLeadDays} days `;
  setMetric(0, run ? String(summary.coldLeadsFound).padStart(2, '0') : '--', run ? `of ${summary.totalContacts} total leads` : 'Run the agent to load data');
  setMetric(1, run ? summary.totalEmails : '--', run ? 'across Gmail threads' : 'No run yet');
  const actionCount = run ? (run.executionMode === 'executed' ? summary.emailsSent : summary.coldLeadsFound) : null;
  setMetric(2, actionCount === null ? '--' : String(actionCount).padStart(2, '0'), run ? (run.executionMode === 'executed' ? 'sent through Gmail' : 'drafts ready to review') : 'No run yet');
  const coverage = run && summary.totalContacts ? Math.max(0, Math.round(((summary.totalContacts - summary.coldLeadsFound) / summary.totalContacts) * 100)) : null;
  metricCards[3].querySelector('strong').textContent = coverage === null ? '--' : coverage >= 70 ? 'Good' : 'Watch';
  metricCards[3].querySelector('.coverage-ring').textContent = coverage === null ? '--' : `${coverage}%`;
  metricCards[3].querySelector('.coverage-bar i').style.width = `${coverage || 0}%`;
  metricCards[3].querySelector('.metric-bottom span').textContent = run ? 'based on latest run' : 'Waiting for first run';
  renderLeads(run?.coldLeads || []);
  renderAllLeads(run?.allLeads || [], leadSearch.value);
  renderTimeline(run);
  renderConnections(data.connections, run);
  if (run) {
    insightQuote.textContent = run.coldLeads.length ? `${run.coldLeads.length} leads need a thoughtful next step. Signal prepared follow-ups from the latest conversation context.` : 'No cold leads were found in the latest run. Your pipeline is clear for now.';
    insightMeta.textContent = `Based on ${summary.totalEmails} emails, ${summary.totalContacts} leads, ${summary.totalCalendarEvents} calendar events`;
  } else {
    insightQuote.textContent = 'Run the agent to see a grounded insight from your real Gmail and CRM activity.';
    insightMeta.textContent = 'No pipeline run has been completed yet';
  }
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Dashboard data unavailable');
    renderDashboard(await response.json());
  } catch (error) {
    showToast(error.message);
  }
}

runButton.addEventListener('click', async () => {
  setLoading(true);
  try {
    const response = await fetch('/api/analyze-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daysBack: 30 }) });
    if (!response.ok) throw new Error('Agent request failed');
    const result = await response.json();
    showToast(`${result.summary?.coldLeadsFound || 0} cold leads found · drafts ready, nothing sent`);
    renderDashboard(await (await fetch('/api/dashboard')).json());
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
});

draftButton.addEventListener('click', () => {
  const firstLead = dashboardState?.run?.coldLeads?.[0]?.lead;
  if (firstLead) document.querySelector('#lead-list .lead-action')?.click();
  else showToast('Run the agent first to draft a real follow-up');
});

sendDraftButton.addEventListener('click', async () => {
  if (!selectedDraft) return;
  sendDraftButton.disabled = true;
  sendDraftButton.textContent = 'Sending...';
  try {
    selectedDraft.subject = document.querySelector('#draft-subject').value;
    selectedDraft.body = document.querySelector('#draft-body').value;
    const response = await fetch('/api/send-followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: selectedDraft.email, subject: selectedDraft.subject, body: selectedDraft.body }) });
    if (!response.ok) throw new Error('Follow-up could not be sent');
    closeLeadReview();
    showToast('Follow-up sent through Gmail');
  } catch (error) {
    showToast(error.message);
    sendDraftButton.disabled = false;
    sendDraftButton.textContent = 'Send follow-up ↗';
  }
});

document.querySelector('#close-modal')?.addEventListener('click', closeLeadReview);
document.querySelector('#close-modal-footer')?.addEventListener('click', closeLeadReview);
leadModal.addEventListener('click', (event) => { if (event.target === leadModal) closeLeadReview(); });
document.querySelector('#close-all-leads')?.addEventListener('click', closeAllLeads);
allLeadsModal.addEventListener('click', (event) => { if (event.target === allLeadsModal) closeAllLeads(); });
leadSearch.addEventListener('input', () => renderAllLeads(dashboardState?.run?.allLeads || [], leadSearch.value));
document.querySelector('#close-activity')?.addEventListener('click', closeActivityLog);
activityModal.addEventListener('click', (event) => { if (event.target === activityModal) closeActivityLog(); });
document.addEventListener('keydown', (event) => { if (event.key !== 'Escape') return; if (leadModal.classList.contains('open')) closeLeadReview(); if (allLeadsModal.classList.contains('open')) closeAllLeads(); if (activityModal.classList.contains('open')) closeActivityLog(); });

document.querySelector('.filter-button')?.addEventListener('click', () => showToast('The current view uses the configured cold-lead window'));
document.querySelector('.view-all')?.addEventListener('click', openAllLeads);
document.querySelector('.manage-button')?.addEventListener('click', () => document.querySelector('#connections')?.scrollIntoView({ behavior: 'smooth' }));
document.querySelector('.activity-link')?.addEventListener('click', openActivityLog);
document.querySelector('.notification')?.addEventListener('click', () => showToast('Notifications are shown after each agent run'));
const savedTheme = window.localStorage.getItem('signal-theme');
if (savedTheme === 'dark') document.body.classList.add('dark-theme');
function updateThemeLabel() { themeToggle.querySelector('.theme-mode').textContent = document.body.classList.contains('dark-theme') ? 'Dark' : 'Light'; }
updateThemeLabel();
themeToggle.addEventListener('click', () => { document.body.classList.toggle('dark-theme'); window.localStorage.setItem('signal-theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light'); updateThemeLabel(); });
document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});

loadDashboard();
