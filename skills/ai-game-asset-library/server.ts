import type { IncomingMessage, ServerResponse } from "node:http";
import httpServer from "./src/http.js";

// Vercel invokes a request handler, while local and Docker deployments use the
// listener exported by src/http.ts. Both routes share the exact same MCP logic.
export default function handler(request: IncomingMessage, response: ServerResponse): void {
  httpServer.emit("request", request, response);
}
