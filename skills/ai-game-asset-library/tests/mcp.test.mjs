import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseEnv = Object.fromEntries(Object.entries(process.env).filter((entry) => typeof entry[1] === "string"));

test("STDIO exposes complete ForgeKit discovery, image, prompt, resource, and export flows", { timeout: 30_000 }, async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "forgekit-mcp-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, "dist", "stdio.js")],
    cwd: root,
    env: { ...baseEnv, FORGEKIT_OUTPUT_ROOT: outputRoot },
    stderr: "pipe",
    maxBufferSize: 20 * 1024 * 1024,
  });
  const client = new Client({ name: "forgekit-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    assert.match(client.getInstructions() || "", /recommend_game_kit/);

    const { tools } = await client.listTools();
    assert.equal(tools.length, 8);
    assert.ok(tools.some(({ name }) => name === "export_game_kit"));

    const packs = await client.callTool({ name: "list_asset_packs", arguments: { includeFrames: false } });
    assert.equal(packs.structuredContent.total, 6);

    const search = await client.callTool({ name: "search_assets", arguments: { query: "racing vehicle", limit: 10 } });
    assert.ok(search.structuredContent.total > 0);
    assert.ok(search.structuredContent.results.some((sprite) => sprite.packId === "arcade-racing"));

    const sprite = await client.callTool({ name: "get_sprite", arguments: { packId: "fantasy-adventure", spriteId: "hero-idle", includeImage: true } });
    const image = sprite.content.find((block) => block.type === "image");
    assert.equal(image.mimeType, "image/png");
    assert.ok(Buffer.from(image.data, "base64").length > 1_000);

    const starter = await client.callTool({
      name: "create_game_starter",
      arguments: { title: "Test Quest", engine: "canvas", packIds: ["fantasy-adventure"] },
    });
    assert.equal(starter.structuredContent.files.length, 4);

    const exported = await client.callTool({
      name: "export_game_kit",
      arguments: {
        destination: "test-game",
        packIds: ["fantasy-adventure"],
        moduleIds: ["core", "canvas"],
        includeStarter: true,
        engine: "canvas",
        title: "Test Quest",
      },
    });
    assert.ok(exported.structuredContent.copied.length >= 8);
    await access(path.join(outputRoot, "test-game", "assets", "fantasy-sprite-atlas.png"));
    await access(path.join(outputRoot, "test-game", "vendor", "forgekit-core.js"));
    assert.match(await readFile(path.join(outputRoot, "test-game", "game.js"), "utf8"), /SpriteSheet/);

    const { resources } = await client.listResources();
    assert.equal(resources.length, 18);
    const manifest = await client.readResource({ uri: "forgekit://catalog/manifest" });
    assert.match(manifest.contents[0].text, /"spriteFrames": 144/);

    const { prompts } = await client.listPrompts();
    assert.equal(prompts.length, 2);
    const prompt = await client.getPrompt({ name: "build_game_with_forgekit", arguments: { gameIdea: "a haunted kart racer", engine: "canvas" } });
    assert.match(prompt.messages[0].content.text, /recommend_game_kit/);
  } finally {
    await client.close().catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("Streamable HTTP exposes the read-only MCP and static asset endpoints", { timeout: 30_000 }, async () => {
  const child = spawn(process.execPath, [path.join(root, "dist", "http.js")], {
    cwd: root,
    env: { ...baseEnv, HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`HTTP server did not start. stderr: ${output}`)), 10_000);
    child.once("exit", (code) => reject(new Error(`HTTP server exited early with code ${code}. stderr: ${output}`)));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+\/mcp)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });

  const client = new Client({ name: "forgekit-http-test", version: "1.0.0" });
  try {
    const base = endpoint.replace(/\/mcp$/, "");
    const health = await fetch(`${base}/health`).then((response) => response.json());
    assert.deepEqual({ ok: health.ok, packs: health.packs, sprites: health.sprites }, { ok: true, packs: 6, sprites: 144 });

    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 7);
    assert.ok(!tools.some(({ name }) => name === "export_game_kit"));

    const module = await client.callTool({ name: "get_code_module", arguments: { moduleId: "world" } });
    assert.match(module.structuredContent.code, /carveRoomsDungeon/);

    const atlasHead = await fetch(`${base}/assets/cozy-farm-atlas.png`, { method: "HEAD" });
    assert.equal(atlasHead.status, 200);
    assert.equal(atlasHead.headers.get("content-type"), "image/png");
  } finally {
    await client.close().catch(() => undefined);
    child.kill("SIGTERM");
  }
});
