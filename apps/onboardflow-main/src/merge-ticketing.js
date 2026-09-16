import { loadDotEnv } from "./env.js";

loadDotEnv();

const API_BASE = process.env.MERGE_API_BASE || "https://api.merge.dev/api/ticketing/v1";

function headers() {
  if (!process.env.MERGE_API_KEY) throw new Error("MERGE_API_KEY is not configured");
  return {
    Authorization: `Bearer ${process.env.MERGE_API_KEY}`,
    ...(process.env.MERGE_ACCOUNT_TOKEN ? { "X-Account-Token": process.env.MERGE_ACCOUNT_TOKEN } : {}),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function mergeRequest(endpoint, { params = {}, method = "GET", body } = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!response.ok) throw new Error(`Merge ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  return parsed;
}

export async function listTickets({ pageSize = 100, tag } = {}) {
  const tickets = [];
  let cursor;
  do {
    const page = await mergeRequest("/tickets", {
      params: { page_size: pageSize, cursor, tags: tag },
    });
    tickets.push(...(page?.results || []));
    cursor = page?.next || undefined;
  } while (cursor && tickets.length < 500);
  return tickets;
}

export async function listCollections() {
  const collections = [];
  let cursor;
  do {
    const page = await mergeRequest("/collections", { params: { page_size: 100, cursor } });
    collections.push(...(page?.results || []));
    cursor = page?.next || undefined;
  } while (cursor);
  return collections;
}

export async function listUsers() {
  const users = [];
  let cursor;
  do {
    const page = await mergeRequest("/users", { params: { page_size: 100, cursor } });
    users.push(...(page?.results || []));
    cursor = page?.next || undefined;
  } while (cursor);
  return users;
}

export async function updateTicket(ticketId, fields) {
  return mergeRequest(`/tickets/${ticketId}`, { method: "PATCH", body: { model: fields } });
}

export async function syncStatus() {
  return mergeRequest("/sync-status", { params: { page_size: 100 } });
}

export async function forceResync() {
  return mergeRequest("/sync-status/resync", { method: "POST" });
}
