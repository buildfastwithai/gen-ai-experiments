#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { catalogStats, createForgeKitServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

const handle = serveStdio(
  () => createForgeKitServer({ allowFilesystemExport: true }),
  { onerror: (error) => console.error(`[${SERVER_NAME}]`, error) },
);

console.error(`[${SERVER_NAME}] v${SERVER_VERSION} ready on stdio`, catalogStats());

async function shutdown(): Promise<void> {
  await handle.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
