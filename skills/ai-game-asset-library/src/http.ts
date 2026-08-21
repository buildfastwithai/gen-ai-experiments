#!/usr/bin/env node
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { LIBRARY_ROOT, localLibraryPath, manifest } from "./catalog.js";
import { catalogStats, createForgeKitServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

const isVercel = Boolean(process.env.VERCEL);
const host = isVercel ? "0.0.0.0" : process.env.HOST || process.env.FORGEKIT_HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.env.FORGEKIT_PORT || 3333);
const configuredHosts = (process.env.FORGEKIT_ALLOWED_HOSTS || "localhost,127.0.0.1,[::1]")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const validateHost = hostHeaderValidation(configuredHosts);
const validateOrigin = originValidation(configuredHosts);

function asHttpsUrl(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  return domain.includes("://") ? domain : `https://${domain}`;
}

const deploymentUrl = asHttpsUrl(process.env.VERCEL_URL);
const productionUrl = asHttpsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
const publicBaseUrl =
  process.env.FORGEKIT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_ENV === "production" ? productionUrl || deploymentUrl : deploymentUrl || productionUrl);

const mcp = createMcpHandler(
  () => createForgeKitServer({
    allowFilesystemExport: false,
    ...(publicBaseUrl ? { baseUrl: publicBaseUrl } : {}),
  }),
  { legacy: "stateless", responseMode: "auto", onerror: (error) => console.error(`[${SERVER_NAME}]`, error) },
);
const handleMcp = toNodeHandler(mcp, { onerror: (error) => console.error(`[${SERVER_NAME}]`, error) });

const publicFiles = new Map<string, { file: string; type: string }>();
for (const pack of manifest.spriteAtlases) publicFiles.set(pack.src, { file: localLibraryPath(pack.src), type: "image/png" });
for (const module of manifest.modules) publicFiles.set(module.src, { file: localLibraryPath(module.src), type: "text/javascript; charset=utf-8" });
publicFiles.set("/asset-manifest.json", { file: path.join(LIBRARY_ROOT, "asset-manifest.json"), type: "application/json; charset=utf-8" });
publicFiles.set("/FORGEKIT-README.md", { file: path.join(LIBRARY_ROOT, "FORGEKIT-README.md"), type: "text/markdown; charset=utf-8" });
publicFiles.set("/README.md", { file: path.join(LIBRARY_ROOT, "README.md"), type: "text/markdown; charset=utf-8" });
publicFiles.set("/LICENSE.txt", { file: path.join(LIBRARY_ROOT, "LICENSE.txt"), type: "text/plain; charset=utf-8" });

function json(res: ServerResponse, statusCode: number, value: unknown): void {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

async function serveFile(req: IncomingMessage, res: ServerResponse, entry: { file: string; type: string }): Promise<void> {
  const info = await stat(entry.file);
  res.writeHead(200, {
    "content-type": entry.type,
    "content-length": info.size,
    "cache-control": "public, max-age=86400, immutable",
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(await readFile(entry.file));
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/mcp") {
      // Host/origin allowlists protect local network servers from DNS rebinding.
      // Vercel already terminates public traffic and can serve custom domains, so
      // applying the localhost allowlist there would reject every remote client.
      if (!isVercel && (!validateHost(req, res) || !validateOrigin(req, res))) return;
      await handleMcp(req as Parameters<typeof handleMcp>[0], res as Parameters<typeof handleMcp>[1]);
      return;
    }

    if (url.pathname === "/health") {
      json(res, 200, { ok: true, name: SERVER_NAME, version: SERVER_VERSION, ...catalogStats(), transport: "streamable-http", mcp: "/mcp" });
      return;
    }

    if (url.pathname === "/") {
      json(res, 200, {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: "ForgeKit game assets and browser-game utilities over MCP",
        mcpEndpoint: "/mcp",
        health: "/health",
        manifest: "/asset-manifest.json",
        ...catalogStats(),
      });
      return;
    }

    const file = publicFiles.get(url.pathname);
    if (file && (req.method === "GET" || req.method === "HEAD")) {
      await serveFile(req, res, file);
      return;
    }

    json(res, 404, { error: "Not found", path: url.pathname });
  } catch (error) {
    console.error(`[${SERVER_NAME}] HTTP error`, error);
    if (!res.headersSent) json(res, 500, { error: "Internal server error" });
    else res.end();
  }
});

export default httpServer;

if (!isVercel) {
  httpServer.listen(port, host, () => {
    const address = httpServer.address();
    const activePort = typeof address === "object" && address ? address.port : port;
    console.error(`[${SERVER_NAME}] v${SERVER_VERSION} listening on http://${host}:${activePort}/mcp`);
  });
}

async function shutdown(): Promise<void> {
  await mcp.close();
  httpServer.close(() => process.exit(0));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
