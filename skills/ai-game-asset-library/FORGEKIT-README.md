# ForgeKit AI Game Asset Library v2

ForgeKit is a dependency-free starter library for AI-generated HTML Canvas and Three.js games. Version 2 expands the vault to six visually distinct worlds, 144 original transparent sprite frames and ten reusable game-code modules.

## Visual worlds

Every atlas is a transparent 1536 × 1024 PNG arranged as 6 columns × 4 rows. Every frame is 256 × 256 pixels.

| World | Style | Good for | Atlas |
|---|---|---|---|
| Fantasy Adventure | Modern 32-bit pixel art | RPG, roguelike, action adventure | `assets/fantasy-sprite-atlas.png` |
| Sci-Fi Outpost | Cel-shaded 2D | Survival, tactics, base building | `assets/sci-fi-outpost-atlas.png` |
| Space Shooter | Neon arcade art | SHMUP, bullet hell, arcade | `assets/space-shooter-atlas.png` |
| Cozy Farm | Hand-painted storybook | Farming, life sim, tycoon | `assets/cozy-farm-atlas.png` |
| Arcade Racing | Glossy top-down game art | Racing, chase, stunt games | `assets/arcade-racing-atlas.png` |
| Gothic Horror | Detailed gothic pixel art | Horror, dungeon, survival | `assets/gothic-horror-atlas.png` |

Use `asset-manifest.json` for the exact frame order and machine-readable metadata.

## Code modules

- `lib/forgekit-core.js` — fixed game loop, input, vectors, collisions, camera, pooling, events, spatial hashing, state machines and storage.
- `lib/forgekit-canvas.js` — sprite sheets, animation, particles, nine-slice UI, responsive canvases, grids, transitions and tweens.
- `lib/forgekit-three.js` — Three.js renderer and scene presets, camera rigs, lights, shadows, texture helpers, instancing, billboards and cleanup.
- `lib/forgekit-audio.js` — procedural Web Audio effects and a compact sequencer.
- `lib/forgekit-procedural.js` — noise, tile atlases, starfields, particle atlases and PNG export.
- `lib/forgekit-ai.js` — A* pathfinding, steering, line of sight, behavior trees and flow fields.
- `lib/forgekit-world.js` — deterministic dungeon rooms, cellular caves, biome maps, spawn scattering and flood fill.
- `lib/forgekit-physics.js` — lightweight bodies, swept collision, grid rays, platformer movement and Verlet constraints.
- `lib/forgekit-shaders.js` — Three.js toon, hologram, water and dissolve shader recipes.
- `lib/forgekit-palettes.js` — twelve palettes, nearest-color remapping, hue shifting and variant downloads.

## Quick start: Canvas

```js
import { GameLoop, Keyboard } from "./lib/forgekit-core.js";
import { loadImage, SpriteSheet } from "./lib/forgekit-canvas.js";

const image = await loadImage("./assets/cozy-farm-atlas.png");
const sheet = new SpriteSheet(image, 6, 4);
const keys = new Keyboard();

new GameLoop({
  update(delta) {
    // Update your game using a fixed delta.
    keys.endFrame();
  },
  render() {
    sheet.draw(ctx, 0, 160, 120, { width: 128, height: 128 });
  },
}).start();
```

## Quick start: procedural dungeon plus AI

```js
import { carveRoomsDungeon } from "./lib/forgekit-world.js";
import { AStarGrid } from "./lib/forgekit-ai.js";

const { grid, start, exit } = carveRoomsDungeon({
  width: 64,
  height: 40,
  rooms: 14,
  seed: "my-game-world",
});

const pathfinder = new AStarGrid(grid.width, grid.height, (x, y) => grid.get(x, y) === 0);
const path = pathfinder.find({ x: start.cx, y: start.cy }, { x: exit.cx, y: exit.cy });
```

## Quick start: Three.js

```js
import * as THREE from "three";
import { createGameRenderer, createGameScene, createCameraRig } from "./lib/forgekit-three.js";
import { createToonMaterial } from "./lib/forgekit-shaders.js";

const renderer = createGameRenderer(THREE, { canvas });
const scene = createGameScene(THREE);
const { rig, camera } = createCameraRig(THREE);
scene.add(rig);

const material = createToonMaterial(THREE, { color: 0x8de7ff });
```

## Making games look different

1. Start with one world as the dominant visual language.
2. Add assets from at most one or two supporting worlds.
3. Name the intended palette, camera and rendering style in the generation prompt.
4. Use `forgekit-palettes.js` for real palette variants instead of tinting everything with CSS.
5. Change procedural world seeds and generator parameters per game.

## License

Code and generated assets in this bundle are released under the MIT License. Attribution is appreciated but not required.
