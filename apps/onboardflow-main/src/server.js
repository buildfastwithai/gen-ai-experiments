import { loadDotEnv } from "./env.js";
loadDotEnv();
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTickets, listCollections, listUsers, updateTicket, syncStatus, forceResync } from "./merge-ticketing.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "../public");
const PORT = Number(process.env.PORT || 3000);
const ONBOARDING_TAG = process.env.ONBOARDING_TAG || "onboarding";
const ONBOARDING_DAYS = Number(process.env.ONBOARDING_DAYS || 14);
const STATUS_OPTIONS = (process.env.STATUS_OPTIONS || "OPEN,IN_PROGRESS,CLOSED").split(",").map((status) => status.trim()).filter(Boolean);

let snapshot = null;

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function normalizeTicket(ticket) {
  return {
    id: ticket.id,
    name: ticket.name || "Untitled",
    description: (ticket.description || "").slice(0, 320),
    status: ticket.status || "OPEN",
    priority: ticket.priority || "NORMAL",
    ticketType: ticket.ticket_type || "task",
    dueDate: ticket.due_date || null,
    createdAt: ticket.remote_created_at || ticket.created_at || null,
    url: ticket.ticket_url || null,
    tags: ticket.tags || [],
    assignees: ticket.assignees || [],
    ageDays: daysSince(ticket.remote_created_at || ticket.created_at),
  };
}

function summarize(tickets) {
  const total = tickets.length;
  const closed = tickets.filter((t) => t.status === "CLOSED").length;
  const open = tickets.filter((t) => t.status !== "CLOSED").length;
  const overdue = tickets.filter((t) => t.status !== "CLOSED" && t.ageDays !== null && t.ageDays > ONBOARDING_DAYS).length;
  const progress = total ? Math.round((closed / total) * 100) : 0;
  return { total, open, closed, overdue, progress };
}

function readinessByAssignee(tickets) {
  const map = {};
  for (const ticket of tickets) {
    const name = ticket.assigneeNames?.[0] || "Unassigned";
    map[name] = map[name] || { total: 0, done: 0 };
    map[name].total += 1;
    if (ticket.status === "CLOSED") map[name].done += 1;
  }
  return Object.entries(map)
    .map(([name, data]) => ({ name, total: data.total, done: data.done, percent: data.total ? Math.round((data.done / data.total) * 100) : 0, unassigned: name === "Unassigned" }))
    .sort((a, b) => a.percent - b.percent);
}

function ticketDue(ticket) {
  if (!ticket.dueDate) return null;
  const days = Math.ceil((new Date(ticket.dueDate).getTime() - Date.now()) / 86_400_000);
  return days;
}

async function scan() {
  const useTag = ONBOARDING_TAG && ONBOARDING_TAG.trim() !== "";
  const [tickets, usersResult, collectionsResult] = await Promise.all([
    listTickets({ tag: useTag ? ONBOARDING_TAG : undefined }),
    listUsers().then((data) => ({ data })).catch((error) => ({ error })),
    listCollections().then((data) => ({ data })).catch((error) => ({ error })),
  ]);
  const users = usersResult.data || [];
  const collections = collectionsResult.data || [];

  const userMap = Object.fromEntries(users.map((user) => [user.id, user.name || user.email]));
  const ticketList = tickets.map(normalizeTicket).map((ticket) => ({
    ...ticket,
    assigneeNames: ticket.assignees.map((id) => userMap[id] || id),
    collectionsUsed: ticket.collections?.length || 0,
  }));

  const enriched = ticketList.map((ticket) => ({ ...ticket, dueInDays: ticketDue(ticket), isUnassigned: !ticket.assignees.length }));

  snapshot = {
    scannedAt: new Date().toISOString(),
    config: { tag: ONBOARDING_TAG, windowDays: ONBOARDING_DAYS, statusOptions: STATUS_OPTIONS },
    summary: summarize(enriched),
    readiness: readinessByAssignee(enriched),
    collectionsUsed: collections.length,
    users: users.length,
    tickets: enriched.sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0)),
  };
  return snapshot;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload, null, 2));
}

function serve(request, response) {
  const requestPath = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return sendJson(response, 403, { error: "Forbidden" });
  fs.readFile(filePath, (error, file) => {
    if (error) return sendJson(response, 404, { error: "Not found" });
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(file);
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 2_000_000) { request.destroy(); reject(new Error("Body too large")); } });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, mergeConfigured: Boolean(process.env.MERGE_API_KEY), accountTokenConfigured: Boolean(process.env.MERGE_ACCOUNT_TOKEN), tag: ONBOARDING_TAG });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      sendJson(response, 200, { snapshot });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/sync-status") {
      const status = await syncStatus();
      sendJson(response, 200, { status });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/resync") {
      const result = await forceResync();
      sendJson(response, 200, { syncing: true, result });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/scan") {
      sendJson(response, 200, await scan());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/tickets/update") {
      const body = JSON.parse(await readBody(request));
      if (!body.id) return sendJson(response, 400, { error: "Ticket id is required" });
      if (body.status && !STATUS_OPTIONS.includes(body.status)) return sendJson(response, 400, { error: `Status "${body.status}" is not supported here.` });
      try {
        const result = await updateTicket(body.id, { status: body.status });
        sendJson(response, 200, { updated: true, result });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
      return;
    }
    if (request.method === "GET") {
      serve(request, response);
      return;
    }
    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => console.log(`OnboardFlow running at http://localhost:${PORT}`));
