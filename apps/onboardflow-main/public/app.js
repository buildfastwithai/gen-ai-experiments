const $ = (selector) => document.querySelector(selector);
let snapshot = null;
let snapshotConfig = {};
let lastData = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function ageLabel(ticket) {
  if (ticket.ageDays === null) return '';
  return `${ticket.ageDays}d old`;
}

function dueBadges(ticket) {
  const badges = [];
  if (ticket.isUnassigned && ticket.status !== 'CLOSED') badges.push('<span class="flag-badge unassigned">Unassigned</span>');
  if (ticket.dueInDays !== null && ticket.dueInDays !== undefined && ticket.status !== 'CLOSED') {
    const cls = ticket.dueInDays <= 0 ? 'overdue' : ticket.dueInDays <= 3 ? 'soon' : '';
    badges.push(`<span class="flag-badge ${cls}">${ticket.dueInDays <= 0 ? 'Due today' : `Due in ${ticket.dueInDays}d`}</span>`);
  }
  return badges.join('');
}

function render(data) {
  lastData = data;
  snapshot = data.tickets || [];
  snapshotConfig = data.config || {};
  const summary = data.summary;
  $('#total-tickets').textContent = summary.total;
  $('#progress').textContent = `${summary.progress}%`;
  $('#open-tickets').textContent = summary.open;
  $('#overdue-count').textContent = summary.overdue;
  $('#updated').textContent = `Synced ${new Date(data.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  $('#status').innerHTML = `<i></i> Merge connected · ${summary.total} tickets`;

  $('#board-list').innerHTML = snapshot.length
    ? snapshot.slice(0, 40).map((ticket) => {
        return `<button class="ticket-row" data-id="${escapeHtml(ticket.id)}"><span class="priority-pill ${escapeHtml(ticket.priority)}">${escapeHtml(ticket.priority)}</span><span class="ticket-info"><b>${escapeHtml(ticket.name)}</b><small>${escapeHtml(ticket.assigneeNames?.[0] || 'Unassigned')} · ${escapeHtml(ticket.status)} · ${escapeHtml(ageLabel(ticket))}</small></span><span class="ticket-flags">${dueBadges(ticket)}</span><span class="status-chip ${escapeHtml(ticket.status)}">${escapeHtml(ticket.status)}</span></button>`;
      }).join('')
    : '<div class="empty">No onboarding tickets yet. Sync your trackers.</div>';

  $('#readiness-list').innerHTML = (data.readiness || []).map((item) => {
    const initials = (item.name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    const tone = item.percent >= 75 ? 'good' : item.percent >= 40 ? 'warn' : 'low';
    return `<div class="readiness-block"><span class="assignee-avatar">${escapeHtml(initials)}</span><div><b>${escapeHtml(item.name)}</b><small>${item.done} of ${item.total} complete</small><div class="readiness-bar"><i class="${tone}" style="width:${item.percent}%"></i></div></div><strong class="${tone}">${item.percent}%</strong></div>`;
  }).join('') || '<div class="empty">No readiness data yet.</div>';

  const triage = snapshot.filter((ticket) => ticket.status !== 'CLOSED' && (ticket.isUnassigned || (ticket.dueInDays !== null && ticket.dueInDays <= 3)));
  $('#triage-list').innerHTML = triage.length
    ? triage.slice(0, 20).map((ticket) => `<button class="triage-row" data-id="${escapeHtml(ticket.id)}"><span class="triage-dot ${ticket.isUnassigned ? 'amber' : (ticket.dueInDays !== null && ticket.dueInDays <= 0 ? 'red' : 'blue')}"></span><div><b>${escapeHtml(ticket.name)}</b><small>${escapeHtml(ticket.assigneeNames?.[0] || 'Unassigned')} · ${escapeHtml(ticket.status)}</small></div><span class="triage-tag">${ticket.isUnassigned ? 'Needs owner' : (ticket.dueInDays !== null && ticket.dueInDays <= 0 ? 'Overdue' : `Due in ${ticket.dueInDays}d`)}</span></button>`).join('')
    : '<div class="empty">Nothing waiting on a person.</div>';

  document.querySelectorAll('.ticket-row, .triage-row').forEach((row) => row.addEventListener('click', () => openTicket(row.dataset.id)));
}

function openTicket(id) {
  const ticket = snapshot.find((item) => item.id === id);
  if (!ticket) return;
  $('#modal-name').textContent = ticket.name;
  $('#modal-priority').textContent = ticket.priority;
  $('#modal-priority').className = `priority-pill ${ticket.priority}`;
  $('#modal-meta').textContent = `${ticket.ticketType || 'task'} · ${ticket.assigneeNames?.[0] || 'Unassigned'} · ${ageLabel(ticket)}`;
  $('#modal-description').textContent = ticket.description || 'No description provided.';
  $('#modal-tags').innerHTML = ticket.tags.length ? ticket.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '';
  $('#status-buttons').innerHTML = (snapshotConfig.statusOptions || ['OPEN', 'IN_PROGRESS', 'CLOSED']).map((status) => `<button class="status-btn ${status === ticket.status ? 'active' : ''}" data-status="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join('');
  document.querySelectorAll('.status-btn').forEach((button) => button.addEventListener('click', async () => {
    document.querySelectorAll('.status-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    button.disabled = true;
    try {
      const response = await fetch('/api/tickets/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticket.id, status: button.dataset.status }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Update failed'); }
      ticket.status = button.dataset.status;
      setTimeout(() => { closeTicket(); render(lastData); }, 450);
    } catch (error) {
      button.classList.remove('active');
      button.disabled = false;
      window.alert(error.message);
    }
  }));
  $('#ticket-modal').classList.add('open');
  $('#ticket-modal').setAttribute('aria-hidden', 'false');
}

function closeTicket() {
  $('#ticket-modal').classList.remove('open');
  $('#ticket-modal').setAttribute('aria-hidden', 'true');
}

$('#scan-button').addEventListener('click', async () => {
  const button = $('#scan-button');
  button.disabled = true;
  button.querySelector('b').textContent = 'Syncing...';
  try {
    const response = await fetch('/api/scan', { method: 'POST' });
    if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Sync failed'); }
    render(await response.json());
    button.querySelector('small').textContent = 'Synced all trackers';
  } catch (error) {
    button.querySelector('small').textContent = error.message;
    $('#board-list').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.querySelector('b').textContent = 'Sync onboarding board';
  }
});

$('#close-ticket').addEventListener('click', closeTicket);
$('#ticket-modal').addEventListener('click', (event) => { if (event.target.id === 'ticket-modal') closeTicket(); });
$('#theme-toggle').addEventListener('click', () => document.body.classList.toggle('dark'));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeTicket(); });

$('#resync-button').addEventListener('click', async () => {
  const button = $('#resync-button');
  button.disabled = true;
  button.textContent = 'Refreshing...';
  try {
    const scan = await fetch('/api/scan', { method: 'POST' });
    render(await scan.json());
    button.textContent = 'Refresh';
    button.disabled = false;
  } catch (error) {
    button.textContent = 'Refresh';
    button.disabled = false;
    window.alert(error.message);
  }
});

async function loadData() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('No snapshot available');
    render((await response.json()).snapshot);
  } catch {
    $('#board-list').innerHTML = '<div class="empty">Press Sync onboarding board to load your queue.</div>';
  }
}

loadData();
