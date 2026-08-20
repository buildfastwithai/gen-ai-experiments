# ForgeKit AI Game Asset Library

ForgeKit is a dependency-free starter library for AI-generated HTML Canvas and Three.js games.

## What is included

- `assets/fantasy-sprite-atlas.png` — transparent 6 × 4 atlas with 24 original pixel-art frames.
- `asset-manifest.json` — dimensions, frame order and module inventory for tools and AI agents.
- `lib/forgekit-core.js` — game loop, keyboard and pointer input, vectors, collision helpers, camera, pooling, events, state machines, spatial hashing, cooldowns and storage.
- `lib/forgekit-canvas.js` — image loading, sprite sheets, animation, particles, nine-slice panels, responsive canvases, grids, transitions and tweens.
- `lib/forgekit-three.js` — renderer and scene presets, camera rigs, lights, shadows, resize handling, textures, third-person controls, instancing, billboards and cleanup.
- `lib/forgekit-audio.js` — procedural Web Audio sound effects and a tiny step sequencer.
- `lib/forgekit-procedural.js` — seeded noise, checker textures, starfields, tile atlases, particle atlases and PNG export.

## Quick start: Canvas

```js
import { GameLoop, Keyboard } from "./lib/forgekit-core.js";
import { loadImage, SpriteSheet } from "./lib/forgekit-canvas.js";

const image = await loadImage("./assets/fantasy-sprite-atlas.png");
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

## Quick start: Three.js

Install or import Three.js separately, then pass its namespace to ForgeKit:

```js
import * as THREE from "three";
import { createGameRenderer, createGameScene, createCameraRig } from "./lib/forgekit-three.js";

const renderer = createGameRenderer(THREE, { canvas });
const scene = createGameScene(THREE);
const { rig, camera } = createCameraRig(THREE);
scene.add(rig);
```

## Sprite frame map

Frames run left-to-right, then top-to-bottom. Each frame is 256 × 256 pixels.

| Frame | Name | Frame | Name |
|---:|---|---:|---|
| 0 | Hero idle | 12 | Gold coin |
| 1 | Hero run | 13 | Mana crystal |
| 2 | Hero back | 14 | Wooden crate |
| 3 | Hero attack | 15 | Treasure chest |
| 4 | Slime idle | 16 | Grass tile |
| 5 | Slime happy | 17 | Stone tile |
| 6 | Slime attack | 18 | Water tile |
| 7 | Slime swarm | 19 | Dirt tile |
| 8 | Silver sword | 20 | Forest tree |
| 9 | Hunter bow | 21 | Mossy rock |
| 10 | Knight shield | 22 | Campfire |
| 11 | Health potion | 23 | Magic portal |

## License

Code and generated assets in this bundle are released under the MIT License. Attribution is appreciated but not required.

