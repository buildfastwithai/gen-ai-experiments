import path from "node:path";
import { findPack, manifest, type AssetPack } from "./catalog.js";

export interface StarterFile {
  path: string;
  purpose: string;
  content: string;
}

export interface GameStarter {
  title: string;
  engine: "canvas" | "three";
  packs: string[];
  requiredModules: string[];
  files: StarterFile[];
  nextSteps: string[];
}

function safeTitle(value: string): string {
  return value.replace(/[<>]/g, "").trim().slice(0, 80) || "ForgeKit Game";
}

function page(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <header><span>FORGEKIT</span><h1>${title}</h1><p>Move with WASD or arrow keys.</p></header>
    <canvas id="game" width="960" height="540" aria-label="${title}"></canvas>
  </main>
  <script type="module" src="./game.js"></script>
</body>
</html>
`;
}

const styles = `* { box-sizing: border-box; }
:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #090c12; color: #eef5ef; }
main { width: min(100% - 32px, 1000px); }
header { display: flex; align-items: baseline; gap: 18px; margin-bottom: 14px; }
header span { color: #69f7bd; font: 800 11px/1 ui-monospace, monospace; letter-spacing: .16em; }
h1 { margin: 0; font-size: clamp(24px, 4vw, 50px); letter-spacing: -.055em; }
header p { margin-left: auto; color: #89948d; font-size: 12px; }
canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid #2f3934; background: #111821; box-shadow: 0 24px 80px #0009; image-rendering: pixelated; }
@media (max-width: 650px) { header p { display: none; } }
`;

function canvasGame(pack: AssetPack): string {
  const atlas = path.basename(pack.src);
  return `import { GameLoop, Keyboard, clamp } from "./vendor/forgekit-core.js";
import { loadImage, SpriteSheet, drawGrid, ParticleEmitter } from "./vendor/forgekit-canvas.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const keys = new Keyboard();
const atlas = await loadImage("./assets/${atlas}");
const sprites = new SpriteSheet(atlas, ${manifest.atlasFormat.columns}, ${manifest.atlasFormat.rows});
const particles = new ParticleEmitter({ colors: ["#69f7bd", "#78a7ff", "#fff38b"], life: [0.2, 0.55] });
const player = { x: canvas.width / 2, y: canvas.height / 2, speed: 230, frame: 0 };

new GameLoop({
  update(delta) {
    const dx = keys.axis("ArrowLeft", "ArrowRight") || keys.axis("KeyA", "KeyD");
    const dy = keys.axis("ArrowUp", "ArrowDown") || keys.axis("KeyW", "KeyS");
    const length = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + dx / length * player.speed * delta, 64, canvas.width - 64);
    player.y = clamp(player.y + dy / length * player.speed * delta, 64, canvas.height - 64);
    player.frame = Math.hypot(dx, dy) > 0 ? 1 : 0;
    if (Math.hypot(dx, dy) > 0 && Math.random() < 0.25) particles.emit(player.x, player.y + 45, 1);
    particles.update(delta);
    keys.endFrame();
  },
  render() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#111b27"); gradient.addColorStop(1, "#1b1527");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, { size: 48, color: "#ffffff0b" });
    particles.draw(ctx);
    sprites.draw(ctx, player.frame, player.x, player.y, { width: 112, height: 112 });
    ctx.fillStyle = "#eef5ef"; ctx.font = "700 14px ui-monospace";
    ctx.fillText("${pack.name.toUpperCase()} / FRAME " + player.frame, 24, 32);
  },
}).start();
`;
}

function threeGame(pack: AssetPack): string {
  const atlas = path.basename(pack.src);
  return `import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { createGameRenderer, createGameScene, addStudioLights, resizeRenderer, createGround } from "./vendor/forgekit-three.js";

const canvas = document.querySelector("#game");
const renderer = createGameRenderer(THREE, { canvas });
const scene = createGameScene(THREE, { background: 0x090c12 });
const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 100);
camera.position.set(0, 4.5, 8); camera.lookAt(0, 1, 0);
addStudioLights(THREE, scene);
scene.add(createGround(THREE, { size: 30, color: 0x17201c }));

const texture = await new THREE.TextureLoader().loadAsync("./assets/${atlas}");
texture.colorSpace = THREE.SRGBColorSpace;
texture.magFilter = THREE.NearestFilter;
texture.repeat.set(1 / ${manifest.atlasFormat.columns}, 1 / ${manifest.atlasFormat.rows});
texture.offset.set(0, 1 - 1 / ${manifest.atlasFormat.rows});
const hero = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
hero.scale.set(2.6, 2.6, 1); hero.position.y = 1.3; scene.add(hero);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const elapsed = clock.getElapsedTime();
  hero.position.y = 1.3 + Math.sin(elapsed * 2.4) * 0.08;
  hero.material.rotation = Math.sin(elapsed * 0.7) * 0.025;
  resizeRenderer(renderer, camera);
  renderer.render(scene, camera);
});
`;
}

export function createGameStarter(options: {
  title: string;
  engine: "canvas" | "three";
  packIds: string[];
  gameIdea?: string;
}): GameStarter {
  const title = safeTitle(options.title);
  const selected = [...new Set(options.packIds)].slice(0, 3).map(findPack);
  const packs = selected.length ? selected : [manifest.spriteAtlases[0]!];
  const dominant = packs[0]!;
  const requiredModules = options.engine === "three"
    ? ["three", "shaders", "palettes"]
    : ["core", "canvas", "audio", "procedural", "palettes"];

  const files: StarterFile[] = [
    { path: "index.html", purpose: "Browser entry point", content: page(title) },
    { path: "styles.css", purpose: "Responsive game-shell styling", content: styles },
    {
      path: "game.js",
      purpose: `${options.engine === "three" ? "Three.js" : "Canvas 2D"} playable starter`,
      content: options.engine === "three" ? threeGame(dominant) : canvasGame(dominant),
    },
    {
      path: "README.md",
      purpose: "Implementation handoff",
      content: `# ${title}\n\n${options.gameIdea || "A browser game powered by ForgeKit."}\n\n## Selected worlds\n\n${packs.map((pack) => `- **${pack.name}** — ${pack.style}; ${pack.games.join(", ")}`).join("\n")}\n\n## Run\n\nServe this directory with any static server, for example \`npx serve .\`. Opening \`index.html\` directly may block ES modules.\n`,
    },
  ];

  return {
    title,
    engine: options.engine,
    packs: packs.map(({ id }) => id),
    requiredModules,
    files,
    nextSteps: [
      "Call export_game_kit in local STDIO mode to copy the selected atlases and modules beside these starter files.",
      "Use search_assets to choose exact frame IDs, then animate with their numeric frame values.",
      "Add forgekit-ai, forgekit-world, or forgekit-physics only when the mechanic needs them.",
      "Keep one pack dominant and vary palette, camera, interface, world seed, and mechanics between games.",
    ],
  };
}
