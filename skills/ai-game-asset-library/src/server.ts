import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  LIBRARY_ROOT,
  allSprites,
  extractSprite,
  findModule,
  findPack,
  findSprite,
  localLibraryPath,
  manifest,
  publicUrl,
  readAtlas,
  readModule,
  recommendKit,
  searchSprites,
  spritesForPack,
} from "./catalog.js";
import { createGameStarter } from "./templates.js";

export const SERVER_NAME = "forgekit-game-assets";
export const SERVER_VERSION = "2.1.0";

export interface ForgeKitServerOptions {
  baseUrl?: string;
  allowFilesystemExport?: boolean;
}

const SERVER_INSTRUCTIONS = `Use ForgeKit whenever creating or reskinning HTML Canvas or Three.js games. Start with recommend_game_kit or list_asset_packs, then call search_assets. Retrieve only the sprites you need with get_sprite; use get_atlas when a game needs the whole sheet. Use create_game_starter and get_code_module for implementation. In local STDIO mode, export_game_kit can copy selected assets and utilities into the active project. Keep one art pack dominant and vary palettes, cameras, UI, seeds, and mechanics so generated games remain visually distinct.

Sprite frames are ordered left-to-right, top-to-bottom in 6x4 transparent atlases. Frame metadata from search_assets is authoritative. Canvas games should use forgekit-core and forgekit-canvas. Three.js games should use forgekit-three and may use forgekit-shaders. Add forgekit-ai, forgekit-world, forgekit-physics, audio, or procedural modules only as the game requires. Never invent ForgeKit asset IDs or frame numbers; search first.`;

function jsonResult(data: Record<string, unknown>, summary?: string) {
  return {
    content: [{ type: "text" as const, text: summary ? `${summary}\n\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function resolveExportRoot(): string {
  return path.resolve(process.env.FORGEKIT_OUTPUT_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function safeDestination(root: string, relativeDestination: string): string {
  if (path.isAbsolute(relativeDestination)) {
    throw new Error("destination must be relative to FORGEKIT_OUTPUT_ROOT (or CLAUDE_PROJECT_DIR in Claude Code)");
  }
  const destination = path.resolve(root, relativeDestination || ".");
  const relative = path.relative(root, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("destination escapes the configured output root");
  }
  return destination;
}

async function copyWithoutUnexpectedOverwrite(source: string, destination: string, overwrite: boolean): Promise<"copied" | "skipped"> {
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, overwrite ? 0 : fsConstants.COPYFILE_EXCL);
    return "copied";
  } catch (error) {
    if (!overwrite && (error as NodeJS.ErrnoException).code === "EEXIST") return "skipped";
    throw error;
  }
}

async function writeWithoutUnexpectedOverwrite(destination: string, content: string, overwrite: boolean): Promise<"copied" | "skipped"> {
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await writeFile(destination, content, { encoding: "utf8", flag: overwrite ? "w" : "wx" });
    return "copied";
  } catch (error) {
    if (!overwrite && (error as NodeJS.ErrnoException).code === "EEXIST") return "skipped";
    throw error;
  }
}

export function createForgeKitServer(options: ForgeKitServerOptions = {}): McpServer {
  const baseUrl = options.baseUrl || process.env.FORGEKIT_PUBLIC_BASE_URL;
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: SERVER_INSTRUCTIONS,
      cacheHints: {
        "tools/list": { ttlMs: 300_000, cacheScope: "public" },
        "resources/list": { ttlMs: 300_000, cacheScope: "public" },
        "prompts/list": { ttlMs: 300_000, cacheScope: "public" },
        "resources/read": { ttlMs: 3_600_000, cacheScope: "public" },
      },
    },
  );

  server.registerTool(
    "list_asset_packs",
    {
      title: "List ForgeKit asset packs",
      description: "List the six visual worlds, their game genres, styles, atlas URLs, and optionally all frame IDs. Use this before choosing a game's art direction.",
      inputSchema: z.object({
        gameType: z.string().trim().optional().describe("Optional genre such as rpg, racing, horror, farming, tactics, or arcade."),
        includeFrames: z.boolean().default(false).describe("Include every sprite frame ID in each matching pack."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ gameType, includeFrames }) => {
      const filter = gameType?.toLowerCase();
      const packs = manifest.spriteAtlases
        .filter((pack) => !filter || pack.games.some((game) => game.includes(filter)) || pack.name.toLowerCase().includes(filter))
        .map((pack) => ({
          id: pack.id,
          name: pack.name,
          style: pack.style,
          games: pack.games,
          frameCount: pack.frames.length,
          atlasUrl: publicUrl(pack.src, baseUrl),
          atlasResource: `forgekit://atlas/${pack.id}`,
          ...(includeFrames ? { frames: pack.frames } : {}),
        }));
      return jsonResult({ total: packs.length, atlasFormat: manifest.atlasFormat, packs }, `Found ${packs.length} ForgeKit visual world${packs.length === 1 ? "" : "s"}.`);
    },
  );

  server.registerTool(
    "search_assets",
    {
      title: "Search ForgeKit sprites",
      description: "Search all 144 sprites by name, category, pack, style, or target game genre. Returns exact frame numbers and crop coordinates for reliable Canvas or Three.js use.",
      inputSchema: z.object({
        query: z.string().trim().default("").describe("What to find, for example hero, enemy, portal, vehicle, farm, or dungeon tile."),
        packId: z.string().trim().optional().describe("Restrict results to one pack ID."),
        gameType: z.string().trim().optional().describe("Restrict results to a game genre."),
        category: z.enum(["character", "enemy", "vehicle", "weapon", "tile", "structure", "effect", "pickup", "prop"]).optional(),
        limit: z.number().int().min(1).max(60).default(24),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, packId, gameType, category, limit }) => {
      const results = searchSprites({
        query,
        limit,
        ...(packId ? { packId } : {}),
        ...(gameType ? { gameType } : {}),
        ...(category ? { category } : {}),
        ...(baseUrl ? { baseUrl } : {}),
      });
      return jsonResult({ query, total: results.length, results }, `Found ${results.length} matching sprite${results.length === 1 ? "" : "s"}.`);
    },
  );

  server.registerTool(
    "get_sprite",
    {
      title: "Get one transparent sprite",
      description: "Return one exact 256x256 transparent sprite cropped from its atlas, together with frame metadata and the reusable atlas URL.",
      inputSchema: z.object({
        spriteId: z.string().trim().min(1).describe("Exact sprite ID from search_assets, for example hero-idle or red-sports-car."),
        packId: z.string().trim().optional().describe("Recommended when the sprite belongs to a known pack."),
        includeImage: z.boolean().default(true).describe("Include the cropped PNG as MCP image content."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ spriteId, packId, includeImage }) => {
      const sprite = findSprite(packId, spriteId, baseUrl);
      const metadata = { sprite, usage: { columns: manifest.atlasFormat.columns, rows: manifest.atlasFormat.rows, frame: sprite.frame } };
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        { type: "text", text: JSON.stringify(metadata, null, 2) },
      ];
      if (includeImage) {
        content.push({ type: "image", data: (await extractSprite(sprite)).toString("base64"), mimeType: "image/png" });
      }
      return { content, structuredContent: metadata };
    },
  );

  server.registerTool(
    "get_atlas",
    {
      title: "Get a complete sprite atlas",
      description: "Return metadata and optionally the full transparent 6x4 PNG atlas for a visual world. Prefer get_sprite if only a few frames are needed.",
      inputSchema: z.object({
        packId: z.string().trim().min(1),
        includeImage: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ packId, includeImage }) => {
      const pack = findPack(packId);
      const metadata = {
        pack: { ...pack, atlasUrl: publicUrl(pack.src, baseUrl), resourceUri: `forgekit://atlas/${pack.id}` },
        atlasFormat: manifest.atlasFormat,
        sprites: spritesForPack(pack, baseUrl),
      };
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        { type: "text", text: JSON.stringify(metadata, null, 2) },
      ];
      if (includeImage) content.push({ type: "image", data: (await readAtlas(packId)).toString("base64"), mimeType: "image/png" });
      return { content, structuredContent: metadata };
    },
  );

  server.registerTool(
    "get_code_module",
    {
      title: "Get a ForgeKit JavaScript module",
      description: "Return the complete source of one dependency-free ForgeKit browser-game module and its CDN URL.",
      inputSchema: z.object({ moduleId: z.enum(["core", "canvas", "three", "audio", "procedural", "ai", "world", "physics", "shaders", "palettes"]) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ moduleId }) => {
      const module = findModule(moduleId);
      const code = await readModule(moduleId);
      return jsonResult({ module: { ...module, url: publicUrl(module.src, baseUrl), resourceUri: `forgekit://module/${module.id}` }, code }, `Loaded forgekit-${moduleId}.js (${module.exports} exports).`);
    },
  );

  server.registerTool(
    "recommend_game_kit",
    {
      title: "Recommend a distinct game kit",
      description: "Turn a game idea into a deliberate combination of visual worlds, sample assets, palettes, and code modules. Use this to prevent generated games from looking alike.",
      inputSchema: z.object({
        gameIdea: z.string().trim().min(3).max(1200),
        engine: z.enum(["canvas", "three"]).default("canvas"),
        maxPacks: z.number().int().min(1).max(3).default(2),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ gameIdea, engine, maxPacks }) => {
      const recommendation = recommendKit(gameIdea, engine, maxPacks, baseUrl);
      return jsonResult(recommendation, `Recommended ${recommendation.packs.map(({ name }) => name).join(" + ")} for this ${engine} game.`);
    },
  );

  server.registerTool(
    "create_game_starter",
    {
      title: "Create a ForgeKit game starter",
      description: "Generate complete index.html, styles.css, game.js, and README contents for a playable Canvas or Three.js starter using selected ForgeKit packs.",
      inputSchema: z.object({
        title: z.string().trim().default("ForgeKit Game"),
        engine: z.enum(["canvas", "three"]).default("canvas"),
        packIds: z.array(z.string().trim()).min(1).max(3).default(["fantasy-adventure"]),
        gameIdea: z.string().trim().max(1200).optional(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ title, engine, packIds, gameIdea }) => {
      const starter = createGameStarter({ title, engine, packIds, ...(gameIdea ? { gameIdea } : {}) });
      return jsonResult({ ...starter }, `Generated a ${starter.engine} starter with ${starter.files.length} text files.`);
    },
  );

  if (options.allowFilesystemExport) {
    server.registerTool(
      "export_game_kit",
      {
        title: "Export ForgeKit files into the project",
        description: "Local STDIO only. Safely copy selected atlases, modules, and optional starter files into a relative directory under the configured project root. Existing files are skipped unless overwrite is true.",
        inputSchema: z.object({
          destination: z.string().trim().default("forgekit-game"),
          packIds: z.array(z.string().trim()).min(1).max(3).default(["fantasy-adventure"]),
          moduleIds: z.array(z.enum(["core", "canvas", "three", "audio", "procedural", "ai", "world", "physics", "shaders", "palettes"])).max(10).default(["core", "canvas", "audio", "palettes"]),
          includeStarter: z.boolean().default(true),
          engine: z.enum(["canvas", "three"]).default("canvas"),
          title: z.string().trim().default("ForgeKit Game"),
          gameIdea: z.string().trim().max(1200).optional(),
          overwrite: z.boolean().default(false),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ destination, packIds, moduleIds, includeStarter, engine, title, gameIdea, overwrite }) => {
        const outputRoot = resolveExportRoot();
        const outputDirectory = safeDestination(outputRoot, destination);
        const packs = [...new Set(packIds)].map(findPack);
        const requiredForStarter = engine === "three" ? ["three", "shaders", "palettes"] : ["core", "canvas", "audio", "procedural", "palettes"];
        const modules = [...new Set([...moduleIds, ...(includeStarter ? requiredForStarter : [])])].map(findModule);
        const copied: string[] = [];
        const skipped: string[] = [];

        for (const pack of packs) {
          const relative = pack.src.replace(/^\//, "");
          const status = await copyWithoutUnexpectedOverwrite(localLibraryPath(pack.src), path.join(outputDirectory, relative), overwrite);
          (status === "copied" ? copied : skipped).push(relative);
        }
        for (const module of modules) {
          const relative = module.src.replace(/^\//, "").replace(/^lib[/\\]/, `vendor${path.sep}`);
          const status = await copyWithoutUnexpectedOverwrite(localLibraryPath(module.src), path.join(outputDirectory, relative), overwrite);
          (status === "copied" ? copied : skipped).push(relative);
        }

        if (includeStarter) {
          const starter = createGameStarter({ title, engine, packIds: packs.map(({ id }) => id), ...(gameIdea ? { gameIdea } : {}) });
          for (const file of starter.files) {
            const status = await writeWithoutUnexpectedOverwrite(path.join(outputDirectory, file.path), file.content, overwrite);
            (status === "copied" ? copied : skipped).push(file.path);
          }
        }

        const selection = {
          generatedBy: `${SERVER_NAME}@${SERVER_VERSION}`,
          packs: packs.map(({ id }) => id),
          modules: modules.map(({ id }) => id),
          atlasFormat: manifest.atlasFormat,
        };
        const selectionStatus = await writeWithoutUnexpectedOverwrite(path.join(outputDirectory, "forgekit-selection.json"), JSON.stringify(selection, null, 2), overwrite);
        (selectionStatus === "copied" ? copied : skipped).push("forgekit-selection.json");

        return jsonResult({ outputRoot, outputDirectory, copied, skipped, overwrite }, `Exported ${copied.length} file${copied.length === 1 ? "" : "s"}; skipped ${skipped.length} existing file${skipped.length === 1 ? "" : "s"}.`);
      },
    );
  }

  server.registerResource(
    "forgekit-manifest",
    "forgekit://catalog/manifest",
    { title: "ForgeKit machine-readable manifest", description: "All packs, frames, modules, dimensions, and totals.", mimeType: "application/json", cacheHint: { ttlMs: 3_600_000, cacheScope: "public" } },
    async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(manifest, null, 2), mimeType: "application/json" }] }),
  );

  server.registerResource(
    "forgekit-guide",
    "forgekit://docs/guide",
    { title: "ForgeKit game-building guide", description: "Usage notes for all art packs and code modules.", mimeType: "text/markdown", cacheHint: { ttlMs: 3_600_000, cacheScope: "public" } },
    async (uri) => ({ contents: [{ uri: uri.href, text: await readFile(path.join(LIBRARY_ROOT, "FORGEKIT-README.md"), "utf8"), mimeType: "text/markdown" }] }),
  );

  for (const pack of manifest.spriteAtlases) {
    server.registerResource(
      `atlas-${pack.id}`,
      `forgekit://atlas/${pack.id}`,
      { title: `${pack.name} atlas`, description: `${pack.style} transparent 6x4 atlas for ${pack.games.join(", ")} games.`, mimeType: "image/png", cacheHint: { ttlMs: 86_400_000, cacheScope: "public" } },
      async (uri) => ({ contents: [{ uri: uri.href, blob: (await readAtlas(pack.id)).toString("base64"), mimeType: "image/png" }] }),
    );
  }

  for (const module of manifest.modules) {
    server.registerResource(
      `module-${module.id}`,
      `forgekit://module/${module.id}`,
      { title: `ForgeKit ${module.id} module`, description: `${module.exports} browser-game exports.`, mimeType: "text/javascript", cacheHint: { ttlMs: 86_400_000, cacheScope: "public" } },
      async (uri) => ({ contents: [{ uri: uri.href, text: await readModule(module.id), mimeType: "text/javascript" }] }),
    );
  }

  server.registerPrompt(
    "build_game_with_forgekit",
    {
      title: "Build an original ForgeKit browser game",
      description: "A reusable prompt that makes an agent plan, select, export, and implement a distinct Canvas or Three.js game.",
      argsSchema: z.object({
        gameIdea: z.string().min(3),
        engine: z.string().default("canvas"),
        constraints: z.string().optional(),
      }),
    },
    ({ gameIdea, engine, constraints }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a polished ${engine} browser game with ForgeKit. Idea: ${gameIdea}.${constraints ? ` Constraints: ${constraints}.` : ""}\n\nFirst call recommend_game_kit. Search for exact assets and record their frame numbers. Use one dominant pack and no more than two supporting packs. Generate a starter, export the selected kit when local export is available, then implement and test the complete playable loop. Vary palette, camera, UI, world generation, and mechanics so this does not resemble generic prior games.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "reskin_game_with_forgekit",
    {
      title: "Reskin an existing game with ForgeKit",
      description: "Choose a new art world and map existing game roles onto exact ForgeKit frames without changing mechanics.",
      argsSchema: z.object({
        currentGame: z.string().min(3),
        desiredMood: z.string().min(2),
        engine: z.string().default("canvas"),
      }),
    },
    ({ currentGame, desiredMood, engine }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Reskin this ${engine} game using ForgeKit while preserving its mechanics: ${currentGame}\nDesired mood: ${desiredMood}. Call recommend_game_kit, then search_assets for each gameplay role. Produce a role-to-frame mapping before editing code. Keep one dominant art pack, update the palette and UI shape language, and verify every referenced frame ID against the MCP results.`,
        },
      }],
    }),
  );

  return server;
}

export function catalogStats() {
  return {
    packs: manifest.spriteAtlases.length,
    sprites: allSprites().length,
    modules: manifest.modules.length,
    exports: manifest.totals.exports,
  };
}
