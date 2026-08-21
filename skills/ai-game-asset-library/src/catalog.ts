import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const moduleLibraryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Vercel bundles the server entrypoint into its function directory while keeping
// traced project files under the function working directory. Local builds keep
// using the directory next to dist/src so the npm and Docker transports behave
// exactly as before.
export const LIBRARY_ROOT = process.env.FORGEKIT_LIBRARY_ROOT
  ? path.resolve(process.env.FORGEKIT_LIBRARY_ROOT)
  : process.env.VERCEL
    ? process.cwd()
    : moduleLibraryRoot;
export const DEFAULT_PUBLIC_BASE_URL =
  "https://cdn.jsdelivr.net/gh/buildfastwithai/gen-ai-experiments@main/skills/ai-game-asset-library";

export interface AtlasFormat {
  columns: number;
  rows: number;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  alpha: boolean;
}

export interface AssetPack {
  id: string;
  name: string;
  style: string;
  games: string[];
  src: string;
  source?: string;
  frames: string[];
}

export interface CodeModule {
  id: string;
  src: string;
  exports: number;
}

export interface AssetManifest {
  name: string;
  version: string;
  license: string;
  totals: {
    spriteAtlases: number;
    spriteFrames: number;
    modules: number;
    exports: number;
  };
  atlasFormat: AtlasFormat;
  spriteAtlases: AssetPack[];
  modules: CodeModule[];
}

export interface SpriteRecord {
  id: string;
  label: string;
  category: string;
  packId: string;
  packName: string;
  packStyle: string;
  games: string[];
  frame: number;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  atlasPath: string;
  atlasUrl: string;
  resourceUri: string;
}

const manifestPath = path.join(LIBRARY_ROOT, "asset-manifest.json");
export const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as AssetManifest;

const categoryRules: Array<[string, RegExp]> = [
  ["character", /(hero|astronaut|farmer|survivor)/],
  ["enemy", /(slime|alien|drone|enemy|boss|zombie|skeleton|ghost|spider)/],
  ["vehicle", /(fighter|interceptor|bomber|scout|car|motorbike|truck|police|taxi|rover)/],
  ["weapon", /(sword|bow|rifle|pistol|laser|missile|shotgun|axe)/],
  ["tile", /(tile|floor|wall|road|track|grass|water|soil|path|swamp|lava|verge)/],
  ["structure", /(chest|crate|terminal|reactor|antenna|turret|airlock|station|satellite|barn|fence|windmill|market|garage|grandstand|barrier|arch|tombstone)/],
  ["effect", /(portal|warp|explosion|black-hole|fire|torch|teleport|checkpoint|ramp)/],
  ["pickup", /(potion|coin|crystal|battery|medkit|chip|power-up|pickup|repair|token|key|satchel)/],
  ["prop", /.*/],
];

function titleCase(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function categoryFor(spriteId: string): string {
  return categoryRules.find(([, pattern]) => pattern.test(spriteId))?.[0] ?? "prop";
}

export function relativeLibraryPath(source: string): string {
  return source.replace(/^[/\\]+/, "").replaceAll("/", path.sep);
}

export function localLibraryPath(source: string): string {
  const relative = relativeLibraryPath(source);
  const resolved = path.resolve(LIBRARY_ROOT, relative);
  const insideRoot = path.relative(LIBRARY_ROOT, resolved);
  if (insideRoot.startsWith("..") || path.isAbsolute(insideRoot)) {
    throw new Error(`Unsafe library path: ${source}`);
  }
  return resolved;
}

export function publicUrl(source: string, baseUrl = process.env.FORGEKIT_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, "")}/${source.replace(/^\//, "")}`;
}

export function findPack(packId: string): AssetPack {
  const pack = manifest.spriteAtlases.find((candidate) => candidate.id === packId);
  if (!pack) {
    throw new Error(`Unknown pack '${packId}'. Available packs: ${manifest.spriteAtlases.map(({ id }) => id).join(", ")}`);
  }
  return pack;
}

export function findModule(moduleId: string): CodeModule {
  const module = manifest.modules.find((candidate) => candidate.id === moduleId);
  if (!module) {
    throw new Error(`Unknown module '${moduleId}'. Available modules: ${manifest.modules.map(({ id }) => id).join(", ")}`);
  }
  return module;
}

export function spritesForPack(pack: AssetPack, baseUrl?: string): SpriteRecord[] {
  const format = manifest.atlasFormat;
  return pack.frames.map((id, frame) => {
    const column = frame % format.columns;
    const row = Math.floor(frame / format.columns);
    return {
      id,
      label: titleCase(id),
      category: categoryFor(id),
      packId: pack.id,
      packName: pack.name,
      packStyle: pack.style,
      games: pack.games,
      frame,
      column,
      row,
      x: column * format.frameWidth,
      y: row * format.frameHeight,
      width: format.frameWidth,
      height: format.frameHeight,
      atlasPath: pack.src.replace(/^\//, ""),
      atlasUrl: publicUrl(pack.src, baseUrl),
      resourceUri: `forgekit://sprite/${pack.id}/${id}`,
    };
  });
}

export function allSprites(baseUrl?: string): SpriteRecord[] {
  return manifest.spriteAtlases.flatMap((pack) => spritesForPack(pack, baseUrl));
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function searchSprites(options: {
  query?: string;
  packId?: string;
  gameType?: string;
  category?: string;
  limit?: number;
  baseUrl?: string;
}): SpriteRecord[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const queryTokens = tokenize(query);
  const limit = Math.max(1, Math.min(options.limit ?? 24, 60));
  const sourcePacks = options.packId ? [findPack(options.packId)] : manifest.spriteAtlases;

  return sourcePacks
    .flatMap((pack) => spritesForPack(pack, options.baseUrl))
    .filter((sprite) => !options.gameType || sprite.games.some((game) => game.includes(options.gameType!.toLowerCase())))
    .filter((sprite) => !options.category || sprite.category === options.category.toLowerCase())
    .map((sprite) => {
      const haystack = `${sprite.id} ${sprite.label} ${sprite.category} ${sprite.packId} ${sprite.packName} ${sprite.packStyle} ${sprite.games.join(" ")}`.toLowerCase();
      const score = queryTokens.reduce((total, token) => {
        if (sprite.id === token || sprite.id.includes(token)) return total + 8;
        if (sprite.category === token) return total + 5;
        if (sprite.games.some((game) => game.includes(token))) return total + 4;
        return total + (haystack.includes(token) ? 2 : 0);
      }, query ? 0 : 1);
      return { sprite, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.sprite.packId.localeCompare(b.sprite.packId) || a.sprite.frame - b.sprite.frame)
    .slice(0, limit)
    .map(({ sprite }) => sprite);
}

export function findSprite(packId: string | undefined, spriteId: string, baseUrl?: string): SpriteRecord {
  const candidates = packId ? spritesForPack(findPack(packId), baseUrl) : allSprites(baseUrl);
  const normalized = spriteId.toLowerCase().trim().replaceAll("_", "-").replaceAll(" ", "-");
  const sprite = candidates.find(({ id }) => id === normalized);
  if (!sprite) {
    const close = searchSprites({
      query: spriteId,
      limit: 8,
      ...(packId ? { packId } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    }).map(({ id, packId: owner }) => `${owner}/${id}`);
    throw new Error(`Unknown sprite '${spriteId}'${packId ? ` in '${packId}'` : ""}. Close matches: ${close.join(", ") || "none"}`);
  }
  return sprite;
}

export async function extractSprite(sprite: SpriteRecord): Promise<Buffer> {
  const pack = findPack(sprite.packId);
  return sharp(localLibraryPath(pack.src))
    .extract({ left: sprite.x, top: sprite.y, width: sprite.width, height: sprite.height })
    .png()
    .toBuffer();
}

export async function readAtlas(packId: string): Promise<Buffer> {
  return readFile(localLibraryPath(findPack(packId).src));
}

export async function readModule(moduleId: string): Promise<string> {
  return readFile(localLibraryPath(findModule(moduleId).src), "utf8");
}

const packKeywords: Record<string, string[]> = {
  "fantasy-adventure": ["fantasy", "rpg", "rogue", "quest", "magic", "knight", "dungeon", "adventure"],
  "sci-fi-outpost": ["sci-fi", "scifi", "space colony", "survival", "tactics", "base", "alien", "moon"],
  "space-shooter": ["space", "shooter", "shmup", "bullet", "asteroid", "ship", "arcade", "galaxy"],
  "cozy-farm": ["cozy", "farm", "farming", "life sim", "village", "garden", "animal", "tycoon"],
  "arcade-racing": ["race", "racing", "car", "vehicle", "chase", "drift", "stunt", "driving"],
  "gothic-horror": ["horror", "gothic", "zombie", "ghost", "dark", "survival", "grave", "haunted"],
};

const paletteByPack: Record<string, string[]> = {
  "fantasy-adventure": ["forest", "ember", "desert"],
  "sci-fi-outpost": ["terminal", "toxic", "ocean"],
  "space-shooter": ["arcade", "vapor", "frost"],
  "cozy-farm": ["candy", "forest", "sunset"],
  "arcade-racing": ["arcade", "sunset", "frost"],
  "gothic-horror": ["noir", "ember", "toxic"],
};

export function recommendKit(description: string, engine: "canvas" | "three", maxPacks: number, baseUrl?: string) {
  const lower = description.toLowerCase();
  const ranked = manifest.spriteAtlases
    .map((pack, index) => ({
      pack,
      score: (packKeywords[pack.id] ?? []).reduce((score, keyword) => score + (lower.includes(keyword) ? keyword.length + 4 : 0), 0) + (index === 0 ? 0.01 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.pack.id.localeCompare(b.pack.id));

  const requested = Math.max(1, Math.min(maxPacks, 3));
  const chosen = ranked.slice(0, requested).map(({ pack }) => pack);
  const dominant = chosen[0] ?? manifest.spriteAtlases[0]!;
  const modules = new Set<string>(["core", engine, "audio", "palettes"]);
  if (/(enemy|npc|path|steer|strategy|tactic)/.test(lower)) modules.add("ai");
  if (/(world|map|dungeon|cave|biome|procedural|rogue)/.test(lower)) modules.add("world");
  if (/(platform|jump|collision|physics|rope|vehicle)/.test(lower)) modules.add("physics");
  if (engine === "three") modules.add("shaders");
  else modules.add("procedural");

  const sampleAssets = chosen.flatMap((pack) => spritesForPack(pack, baseUrl).filter((_, index) => [0, 4, 8, 12, 16, 20, 23].includes(index)).slice(0, 5));
  return {
    idea: description,
    engine,
    dominantPack: dominant.id,
    packs: chosen.map((pack) => ({ id: pack.id, name: pack.name, style: pack.style, games: pack.games, atlasUrl: publicUrl(pack.src, baseUrl) })),
    modules: [...modules].map((id) => ({ id, url: publicUrl(findModule(id).src, baseUrl) })),
    palettes: paletteByPack[dominant.id] ?? ["arcade", "forest", "noir"],
    sampleAssets,
    direction: `Use ${dominant.name} as the dominant visual language. ${chosen.slice(1).length ? `Borrow only selected props or effects from ${chosen.slice(1).map(({ name }) => name).join(" and ")}.` : "Keep the pack visually consistent."} Build for ${engine === "three" ? "Three.js" : "HTML Canvas 2D"}, preserve transparent sprite edges, and vary the camera, palette, world seed, UI shape language, and moment-to-moment mechanics.`,
  };
}
