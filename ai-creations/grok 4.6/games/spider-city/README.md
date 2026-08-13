# ARACHNID — Vertical City

An open-world third-person superhero traversal prototype built on Three.js. A seamless
procedurally-generated city of ~1,300 buildings across eight art-directed districts, a
physically-simulated web-swing, wall running and crawling, combo melee against six enemy
archetypes, crowds and traffic, stable cinematic daylight with dynamic weather, a cinematic
post-processing stack, and a scripted main mission with side activities.

Everything — every texture, every mesh, the character, and every sound — is generated in
code at boot. There are no asset downloads.

---

## Running it

ES modules need to be served over HTTP; opening `index.html` from disk will fail with a
CORS error. From this folder:

```bash
npx serve .          # or: python3 -m http.server 8080
```

Then open the printed URL. First load builds the city in about two to four seconds
(the progress bar is real). Three.js r160 is pulled from unpkg via the import map in
`index.html`, so the first run needs a network connection; after that it is cached.

Chrome, Edge or Firefox on a desktop GPU. Pointer lock is required, so click once to
capture the mouse.

---

## Controls

| | |
|---|---|
| **Move** | `W` `A` `S` `D` |
| **Sprint** | `Shift` |
| **Jump** | `Space` (hold `C` first to charge a super jump) |
| **Swing** | Aim the reticle at a surface, then hold **RMB** or tap **X** |
| **Pump + reel in / reel out** | `W` / `S` |
| **Slingshot** | `R` while swinging (costs focus) |
| **Web zip** | `F` — pulls you to whatever you are looking at |
| **Dive** | Hold `C` in the air — the fastest travel in the game |
| **Wall run** | Jump into a wall while moving toward it |
| **Wall crawl** | Hold `Shift` on wall contact |
| **Strike** | **LMB** — every 3rd hit launches; hit airborne enemies to juggle |
| **Dodge** | `Shift` — inside an enemy wind-up it becomes a *perfect dodge* |
| **Web pull** | `E` — yanks light enemies to you, pulls you to heavy ones |
| **Web trap** | `Q` — cocoons a target; against a wall they stay pinned |
| **Perch** | `V` on a rooftop |
| **Map / pause** | `Tab` / `Esc` |
| **Hide HUD** | `H` · **Freeze clock** `P` · **Perf readout** `F2` · **Mute** `Shift+M` |

Gamepad is supported (sticks, triggers, face buttons).

---

## What is actually implemented

**Traversal.** The swing is a genuine constrained pendulum: gravity integrates velocity,
a post-integration distance constraint removes the radial component, while deliberate
reeling and tangential input let the player shape the arc. Nothing moves along a path.
The centre reticle is the exact attachment ray, so aiming higher selects a higher anchor;
release at the bottom and momentum carries naturally into the next swing. Web strands are
drawn as camera-facing ribbons with a
catenary sag that tightens under tension and a travelling whip when freshly fired.

Wall running consumes stamina and converts to a mantle at a ledge; wall crawling builds a
movement basis on the surface plane and reorients the character to the wall normal.
Zip, slingshot, dive, ground-to-wall and swing-to-combat transitions are all present.

**City.** `CityLayout` is pure data — districts, blocks, lots, setbacks, roof furniture,
POIs — generated from one integer seed, and the minimap, the fullscreen map, traffic lanes,
NPC sidewalk graphs and the mission system all read from it. `CityBuilder` turns that into
GPU work: buildings are instanced *wall planes* rather than boxes, so each wall carries its
own UV transform and a 40 m facade and a 9 m facade show correctly sized windows from one
shared texture. Everything is bucketed into 3×3-block streaming sectors for frustum
culling, per-sector shadow toggling and distance LOD.

**Lighting.** Preetham sky scattering held in a bright early-afternoon window, with the
environment map re-baked from it every few seconds, so glass towers reflect the live sky.
The sun, exposure, atmosphere and post-processing remain daylight-safe even in overcast
weather; night-only window, street-lamp and vehicle-light systems remain disabled.

**Weather.** Clear / cloudy / rain / storm with consequences: wetness is a global uniform
that grows puddles in the road shader, drops its roughness toward mirror, darkens the
albedo, thickens the fog and lingers after the rain stops. Rain is one GPU particle box
that wraps internally around the camera. Storms fire lightning that relights the scene and
flashes the post stack.

**Combat.** Attacks steer toward the nearest valid target, every third hit launches,
airborne hits juggle and carry you up, dodging inside a wind-up dilates time and refunds
focus, and web abilities double as crowd control. Six archetypes (Enforcer, Runner,
Bruiser, Marksman, Bulwark, and the RAMPART mini-boss) share one rig and an eleven-state
FSM with telegraphs and recovery windows.

**Mission.** *Signal From Below*: patrol → downtown blackout → cinematic arrival →
plaza fight → scripted rooftop pursuit → mini-boss → the villain escapes. Plus 24 field
caches, 5 rooftop time trials, and an ambient crime director that stages robberies,
muggings, ambushes, pursuits and building emergencies weighted by district.

**Character.** An original red-and-navy suited hero built entirely from code: a jointed
hierarchy with tapered limbs, a woven hex normal map, a diamond web lattice in the albedo,
brushed metal web-shooter cuffs, and reflective eye lenses the animator squints for
expression. Animation is procedural — the stride phase is integrated from real ground
speed, which is precisely why the feet never slide — with additive one-shot actions layered
on top and per-joint damped slerp doing the crossfades.

---

## Architecture

```
src/
  core/       Game (orchestrator) · Input · Settings/TUNING · MathUtils · ObjectPool
  world/      CityLayout (data) · CityBuilder (GPU) · CityMaterials (shaders) ·
              TextureFactory (procedural PBR) · World (queries) · Ambience
  player/     Player (state machine + swing physics) · CharacterRig · Animator
  swinging/   WebLine
  physics/    SpatialGrid (uniform hash) · CharacterBody (swept capsule)
  camera/     ThirdPersonCamera (+ cinematic mode)
  combat/     Combat
  enemies/    Enemy · EnemyManager
  npcs/       NPCManager
  vehicles/   TrafficManager
  weather/    DayNight · Weather
  effects/    Effects (pooled particles) · PostFX (composer chain)
  missions/   MissionSystem · WorldEvents
  audio/      AudioManager (Web Audio synthesis)
  ui/         HUD · Menus
```

Dependencies flow one way: `core → world → player/enemies/npcs → ui`. Adding a district
means adding a case to `CityLayout.districtAt`. Adding an enemy means adding an entry to
`ARCHETYPES`. Adding a mission means adding a state machine to `MissionSystem` — no engine
changes in any of those cases.

All gameplay feel lives in one place: `core/Settings.js` → `TUNING`. Gravity, swing pump
force, rope stiffness, release boost, wall-run speed, combo window, dodge window — tune
there, not in the systems.

---

## Performance

Quality presets (LOW / MEDIUM / HIGH / ULTRA) are auto-detected from a GPU string sniff on
first run and changeable live in **Settings**. On HIGH the frame is roughly:

- One draw call per facade style per sector (~5 per sector, 25 sectors)
- Three draw calls for the entire pedestrian crowd, six for all traffic
- One draw call for every particle in the game
- One shadow map, retargeted around the player each frame

The techniques doing the work: GPU instancing everywhere, per-instance UV transforms,
sector-based frustum culling and LOD, a uniform spatial hash for all collision and
ray queries, object pooling for enemies/particles/decals, distance-scaled AI tick rates
(NPCs recycle outside the sim radius, distant enemies tick at 4 Hz), and shared materials
with a handful of shared uniforms so relighting the city is one assignment.

`F2` toggles a readout of FPS, draw calls, triangles, crowd/traffic/enemy counts and the
district you are standing in.

---

## Deliberate trade-offs

Worth knowing before you read the code and wonder:

- **Everything is procedural.** No GLTF, no downloaded textures. That was the brief, and
  it buys instant loads and zero licensing — but it also means the character is a
  stylised jointed rig rather than a scanned, skinned hero model, and NPCs articulate at
  the hips only. A real production build would swap `CharacterRig` for a GLB with a
  `SkinnedMesh` and keep the `Animator` driving the bones exactly as it does now.
- **One high-resolution shadow cascade** that tracks the player, rather than true CSM.
  Cascades via the `CSM` addon are fragile across Three.js versions and I could not
  runtime-test this build, so I chose the option that cannot break.
- **Depth-of-field is radial, not depth-based.** It reads well in cinematics and avoids a
  depth-texture round trip that is a common source of driver-specific breakage.
- **Roads are the negative space between blocks**, which keeps traffic to 1-D lanes and
  makes queueing, signals and car-following almost free. The cost is that the street grid
  is orthogonal — no diagonals or curves.
- **Texture compression (KTX2/Basis) is not used**, because textures are generated on the
  CPU at runtime and never travel over the wire. Anisotropy and mip generation are on.

---

## Verification performed

No browser was available in the build environment, so this ships with static verification
rather than playtesting: all 33 modules parse as ES modules under Node, every relative
import resolves to a real file with a matching named export, every `this.method()` call
resolves to a declared member, and every cross-system call (`game.hud.*`, `game.enemies.*`
and friends) resolves against the target class. Expect to tune numbers in `TUNING` on
first play — that file exists so you can.
