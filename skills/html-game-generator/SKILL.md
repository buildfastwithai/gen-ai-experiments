---
name: html-game-generator
description: Build a complete, polished, production-quality browser game inside a single self-contained HTML file using only vanilla HTML, CSS and JavaScript — no frameworks, no libraries, no external assets. Use this skill whenever the user asks for a game, a playable demo, a prototype, an interactive toy, or anything "inspired by" an existing title — platformers, tower defense, RTS, racing, RPGs, physics games, city builders, simulations, card games, survival, idle/incremental, puzzle and arcade games all qualify. Trigger it even when the user never says "HTML" or "single file", and even for requests that sound small ("make me a snake game", "something to kill five minutes"), because the default deliverable is always one finished .html file with menus, art, sound, particles and save support built in. Also use it when the user wants an existing single-file game extended, rebalanced, or polished.
---

# HTML Game Generator

Turn a game idea into one HTML file the user can double-click and play — finished, not prototyped.

## Purpose

The deliverable is a complete game: title screen, tutorial or control hints, core loop, difficulty progression, win/lose states, sound, particles, persistence, and a restart path. It runs offline from the filesystem with zero setup, zero build step, zero network requests, and zero dependencies.

The failure mode worth naming up front is **the tech demo**: a grey rectangle that moves, one enemy, no menu, no sound, `// TODO: add more levels`. That is not the deliverable. A user who asks for a tower defense game wants to play tower defense for twenty minutes, not to see that tower defense is possible. Every choice in this skill points at that difference.

The second failure mode is **scope collapse under pressure** — quietly dropping the third enemy type or the upgrade shop because the file was getting long. Length is not the constraint. If something has to give, simplify how things *look*, never what the player can *do*.

## Capabilities

Determine which systems the game needs and build them. The request rarely names them; infer from the genre and the described experience.

- **Physics** — AABB and swept collision, gravity and drag, impulse resolution, verlet ropes/soft bodies, projectile ballistics, restitution and friction.
- **AI** — finite state machines, steering behaviours (seek/flee/wander/separate), flocking, aggro and threat, difficulty curves, opponent decks and build orders, utility scoring.
- **Pathfinding** — A* on grids, flow fields for many units, line-of-sight and simple navmesh, local avoidance.
- **Procedural generation** — value noise, cellular automata caves, room-and-corridor dungeons, wave-function-collapse-style tiling, weighted loot and encounter tables, seeded RNG for reproducibility.
- **Combat** — hitboxes/hurtboxes, i-frames, damage types and resistances, knockback, status effects, cooldowns, crits.
- **Economy and progression** — currencies, costs and rewards, XP curves, upgrade trees, unlocks, prestige loops.
- **Inventory and crafting** — grid or list inventories, stacking, equipment slots, recipes, containers.
- **Rendering** — Canvas 2D, layered canvases, camera with follow/lerp/shake, parallax, tilemaps with culling, procedural sprite generation, lighting and fog of war, DOM/CSS for UI.
- **Particles and effects** — pooled emitters, screen shake, hit-stop, flashes, trails, weather.
- **Audio** — full Web Audio synthesis: SFX, adaptive music, mixing, ducking.
- **UI** — menus, HUD, modals, tooltips, drag-and-drop, minimaps, tech trees, settings, pause.
- **Animation** — tweening with easing, sprite and skeletal-style animation, state-driven transitions.
- **Persistence** — LocalStorage saves with versioning and migration, autosave, settings, high scores.

Implementations for all of these live in `references/engine-patterns.md`. Read it before writing the engine layer of any non-trivial game.

## Output Rules

These are hard requirements. Violating them means the deliverable doesn't work when the user opens it.

1. **One file.** A single `.html` document containing everything. No companion `.js`, `.css`, `.json`, image or audio files.
2. **Vanilla only.** HTML, CSS, JavaScript. Nothing else.
3. **No libraries, ever.** Not React, Vue, Angular, Svelte, Phaser, PixiJS, Matter.js, Planck, Three.js, Babylon, p5.js, Howler, Tone.js, Tailwind, Bootstrap, jQuery, GSAP, lodash, or anything else. No `<script src="…">`, no `import` from a URL, no CDN, no npm, no Google Fonts. Every algorithm is written by hand.
4. **CSS inside `<style>`.** In `<head>`. No external stylesheets.
5. **JavaScript inside `<script>`.** Before `</body>`. No external scripts, no ES module imports.
6. **Graphics are generated in code.** Canvas draw calls, inline SVG, CSS gradients and shapes. No image files, no base64 sprite blobs, no emoji-as-art unless the aesthetic genuinely calls for it.
7. **Audio is synthesised.** Web Audio API oscillators, noise buffers, filters and envelopes. No audio files, no base64 audio.
8. **Offline-first.** `file://` must work. No fetch, no XHR, no WebSocket, no analytics.
9. **No TODOs, no placeholders, no stubs.** Every function does its job. Every referenced asset exists. Every menu button works.
10. **Nothing requested gets silently dropped.** If a feature is genuinely impossible in a browser, say so explicitly and ship the closest workable alternative.

Deliver the file, then a short note: what was built, the controls, and any deliberate simplifications. Not a tutorial on the code.

## Development Standards

**Fixed-timestep simulation, interpolated rendering.** Physics and game logic step at a fixed rate (60 Hz, or 30 Hz for heavy simulations) with an accumulator; rendering happens once per `requestAnimationFrame`. This is what keeps a game from behaving differently on a 144 Hz monitor than on a 60 Hz one, and it makes collisions deterministic. Clamp the accumulator so a backgrounded tab doesn't produce a thousand catch-up steps.

**One `requestAnimationFrame` loop.** Never `setInterval` for gameplay. Never a second rAF loop. Pause the loop on `visibilitychange` and on the pause menu.

**Canvas sizing.** Size the backing store to `cssWidth * devicePixelRatio`, set the CSS size separately, and scale the context — otherwise everything is blurry on retina displays. Re-run on resize, debounced.

**Input is state, not events.** Event handlers write into an input object; the update step reads it. This makes controls remappable, makes touch and keyboard interchangeable, and prevents input from being processed at a different rate than simulation. Track both "is held" and "was pressed this frame".

**Seeded RNG for anything procedural.** A tiny `mulberry32` means a run can be reproduced and a seed can be shown to the player.

**Design for the failure cases.** LocalStorage can throw in private mode. AudioContext starts suspended until a user gesture. The canvas can be zero-sized before layout settles. Handle all three; each one is a "the game doesn't work for me" report otherwise.

## Code Quality

Everything lives in one file, which makes discipline more important, not less. Organise it so a reader can navigate by scrolling.

Order the `<script>` as: constants and config → utilities (math, RNG, easing) → audio → input → procedural art → entity classes → systems → world/level → UI → game state machine → boot. Separate each block with a banner comment.

- **Classes for things with identity and lifetime** (`Player`, `Enemy`, `Tower`, `ParticleSystem`, `Camera`). **Plain functions for transformations** (`aabb`, `lerp`, `easeOutCubic`).
- **A single `CONFIG` object at the top** holding every tunable number: speeds, damages, costs, spawn rates, colours. Balance changes should happen in one place, and the user should be able to find it. Magic numbers scattered through the code are the main reason a generated game can't be modified afterward.
- **Meaningful names.** `enemySpawnInterval`, not `t2`. `applyKnockback`, not `doStuff`.
- **Comment the why.** `// separate the axes so a wall slide doesn't snag on tile seams` earns its line. `// increment i` does not.
- **No duplication.** One `drawRoundedRect`, one `spawnParticles`, one `playTone` — used everywhere.
- **Strict mode, no leaking globals.** Wrap in an IIFE or keep everything at a single module scope with `const`/`let`. `'use strict';` at the top.
- **No `eval`, no `document.write`, no inline `onclick` attributes.** Attach listeners in script.

## Game Design Principles

Code correctness is not the same as the game being good. These decide whether the user keeps playing.

**Playable in ten seconds.** Menu → game with one click. Controls discoverable without reading. If a mechanic needs explanation, teach it in the first encounter rather than in a wall of text.

**A loop with tension and release.** Something threatens, the player responds, the player is rewarded, the threat escalates. Even a puzzle game needs this rhythm.

**Difficulty ramps, not walls.** Start below the player's ability and climb past it. Prefer curves (`spawnRate = base * pow(1.04, minute)`) over hand-authored tables, and make the curve a CONFIG value.

**Meaningful choices.** Two upgrades that both say "+10% damage" are one upgrade. Options should trade off against each other.

**Immediate, legible feedback.** Every input produces a visible and audible reaction within one frame. Every hit registers. Every currency change animates. Silence and stillness read as "broken".

**Fail forward.** Death shows a score, a stat summary, what killed you, and a one-key restart. Never a dead end.

**Respect the player's time.** No unskippable animations, no mandatory waiting, no losing progress to a misclick.

## Performance Requirements

Target 60 fps on a mid-range laptop and a three-year-old phone. Test the worst case — the moment with the most entities on screen — not the calm opening.

- **Pool everything transient.** Particles, bullets, damage numbers, enemies. Allocation during play causes GC pauses that read as stutter. Pre-allocate and recycle with an active flag.
- **Never allocate inside the loop.** No object or array literals, no `.map`/`.filter`/`.slice` per frame, no string building in hot paths. Reuse scratch vectors.
- **Broad-phase before narrow-phase.** A uniform spatial hash or grid turns O(n²) collision into near-linear. Mandatory past ~150 interacting entities.
- **Cull aggressively.** Skip updates and draws for anything outside the camera bounds plus a margin.
- **Cache static rendering.** Pre-render tilemaps, backgrounds, star fields and generated sprites to offscreen canvases once, then blit. Re-render only on change.
- **Batch canvas state.** Group by fill and stroke style; avoid per-entity `save`/`restore` when a plain translate suffices; avoid `shadowBlur` in hot loops (it is very expensive) — fake glow with a pre-rendered radial gradient sprite.
- **Layer canvases** when a static or slow layer sits behind a fast one (background / world / UI).
- **Keep the DOM out of the loop.** Update HUD elements only when their value changes, never every frame.
- **Cap particles** with a hard ceiling and let the oldest expire. Put the budget (e.g. 600) in CONFIG.
- **Degrade gracefully.** If a rolling average frame time exceeds budget, reduce particle counts and disable expensive effects automatically rather than dropping frames.

## UI/UX Standards

The UI is what separates "a demo" from "a game". Build it in DOM/CSS layered over the canvas — it's easier to make responsive and accessible than canvas-drawn text.

**Required screens:** title (play, options, how-to-play, and a visible high score if scores exist), the in-game HUD, pause, and game-over/victory. Options should at minimum expose master/SFX/music volume and a reduced-motion toggle.

**Visual design:** commit to a coherent palette (4–6 colours plus neutrals) and use it consistently. Use a real type hierarchy. Rounded corners, soft shadows and a clear accent colour carry a lot. Avoid pure `#000`/`#FFF` in favour of near-black and off-white. Keep a consistent margin scale.

**HUD rules:** show only what the player acts on. Anchor it to screen edges, never over the centre of the play area. Animate value changes (count up, flash, scale-pop) rather than snapping. Health and resource bars need instant damage feedback plus a delayed "ghost" bar behind.

**Feedback and affordance:** hover and active states on every clickable element, a cursor change, a click sound. Disabled buttons look disabled and explain why on hover.

**Accessibility:** keyboard-navigable menus with visible focus rings. Text at least 14px with real contrast. Never encode critical information in colour alone — pair it with a shape or a label. Honour `prefers-reduced-motion` by cutting screen shake and flashes. Always provide a pause key.

## Animation Guidelines

Animation is game feel. A game with identical mechanics feels twice as good with it.

- **Ease everything.** Nothing moves linearly except constant-velocity projectiles. `easeOutCubic` for arrivals, `easeOutBack` for pops, `easeInOutQuad` for camera moves.
- **Anticipation and follow-through.** Squash before a jump, stretch during it, squash on land. A tower recoils when it fires. A card lifts before it flies.
- **Hit-stop.** Freeze the simulation for 40–90ms on a significant impact. This single technique does more for impact than any particle effect.
- **Screen shake, tuned.** Trauma-based — a 0–1 value that decays, with shake proportional to trauma² — so small hits barely register and big ones are dramatic. Cap it, and respect reduced-motion.
- **Camera with personality.** Lerp toward the target, lead slightly in the direction of movement, zoom out with speed, clamp to world bounds.
- **Transitions, not cuts.** Fade or wipe between screens over 200–400ms. Instant cuts feel like bugs.
- **Telegraph.** Enemy attacks get a wind-up. Spawns get a warning marker. Nothing dangerous appears without notice.
- **Idle motion.** Bobbing pickups, breathing characters, drifting clouds. A static screen looks frozen.
- **Damage numbers** that rise, fade, and vary slightly in position so stacks stay readable.

## Audio Guidelines

All audio is synthesised at runtime with the Web Audio API. Working recipes are in `references/audio-recipes.md`.

- **Create the `AudioContext` lazily and resume it on the first user gesture.** Browsers block autoplay; a game that boots silently and never recovers is the most common audio bug.
- **Always envelope.** A raw oscillator start/stop produces a click. Use attack/decay/sustain/release via `gain.gain.exponentialRampToValueAtTime` — and never ramp to exactly 0, use 0.0001.
- **Give each sound a character:** square/pulse for retro blips, sawtooth through a lowpass for weight, filtered white noise for explosions, wind and footsteps, sine with a fast pitch drop for kicks and impacts, FM for bells and pickups.
- **Vary repeated sounds** by ±5% pitch so rapid fire doesn't turn into a machine-gun drone.
- **Bus structure:** master gain → SFX bus and music bus, each with its own gain. Persist volumes to LocalStorage. Provide mute.
- **Limit voices.** Cap concurrent SFX (e.g. 12) and drop the oldest or quietest, otherwise a big explosion clips into distortion.
- **Music** as a simple scheduled sequencer: a scale, an arpeggio or bass pattern, a pad, scheduled ahead using `ctx.currentTime` — never `setInterval`. Adapt intensity to game state by adding a percussion layer when danger rises.
- **Never autoplay loudly.** Default master volume around 0.5.

## Mobile Support

Assume a phone will open this. Design for it rather than adding it at the end.

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`
- **Touch controls appropriate to the genre:** virtual joystick plus buttons for action games, tap and drag for strategy and card games, swipe for puzzle games, tilt only as an option and never as the sole scheme. Detect touch capability and show the right controls, but don't disable keyboard and mouse.
- **Hit targets ≥ 44px.** Fingers are imprecise, and the finger also covers the screen — put controls in the lower corners and keep critical information above them.
- **`touch-action: none`** on the play surface plus `preventDefault` on touch handlers to stop scroll, pull-to-refresh and double-tap zoom. `user-select: none` to stop text selection during drags.
- **Handle both orientations,** or show a rotate prompt if the game genuinely requires one. Use `dvh` units, not `vh`, so mobile browser chrome doesn't crop the layout. Respect `env(safe-area-inset-*)` for notches.
- **Scale the world, not the camera crop** — mobile players should see a comparable amount of the world, not a cropped desktop view.
- **Lower the defaults on mobile:** cap DPR at 2, reduce the particle budget, skip the most expensive effects.

## Architecture Guidelines

One file, but structured as if it were many.

```
CONFIG            all tunable values
Utils             clamp, lerp, rand, seeded RNG, easing, AABB, vector helpers
Audio             AudioContext, buses, synth voices, music scheduler
Input             keyboard/mouse/touch → normalised state object
Art               procedural sprite and tile generation into offscreen canvases
Entities          Player, Enemy, Projectile, Tower, Item… (classes)
Systems           Physics, Collision, AI, Spawner, Particles, Camera, Save
World             level/grid/map, generation, queries
UI                screens, HUD, menus, tooltips, notifications
Game              state machine: BOOT → MENU → PLAY ⇄ PAUSE → GAMEOVER
boot()            wire it together, start the loop
```

**Explicit game state machine.** A single `state` variable with an enum, and `update`/`render` dispatching on it. Ad-hoc booleans (`isPaused`, `isMenu`, `isDead`) always end up in contradictory combinations.

**Entities own their data and behaviour; systems own the relationships.** A `Bullet` knows its velocity and how to draw itself; the collision system knows what bullets hit. For games with many entity types and shared behaviour — survivors-likes, simulations — a light component approach (plain objects with optional fields, systems iterating over arrays) scales better than deep inheritance. Never build more than two levels of class hierarchy.

**Events over polling for rare things.** A tiny pub/sub (`on`, `emit`) decouples "enemy died" from the six systems that care: score, particles, audio, quests, drops, achievements.

**All persistence through one save module** with a schema version, so a later change doesn't corrupt an existing save. Wrap reads and writes in try/catch and fall back to defaults.

## Genre-Specific Adaptation

Read the request, identify the genre, and build the systems that genre actually requires. `references/genres.md` carries a full playbook per genre — required systems, the core loop, the balance levers, and the pitfalls. Consult the matching entry before planning the architecture.

The short version:

| Genre | Non-negotiable systems |
|---|---|
| **Platformer** | Tile collision (axes resolved separately), coyote time, jump buffering, variable jump height, camera look-ahead, hazards, checkpoints |
| **Tower defense** | Path or flow field, wave scheduler, placement grid, targeting priorities, projectile lead, economy, upgrade and sell |
| **RTS / lane battler** | Unit selection or card deploy, pathfinding with local avoidance, formations, resource income, opponent AI with a build order |
| **Racing** | Track spline or tiles, throttle-brake-steer with grip and drift, lap and checkpoint validation, rival AI on racing lines, minimap |
| **RPG** | Stats and levels, turn-based or action combat, inventory and equipment, dialogue, quests, world map, saves |
| **Physics** | Verlet or impulse solver, restitution and friction, destructible structures, aiming with trajectory preview, stable resting contacts |
| **City builder / management** | Tile grid, placement validity, resource flow simulation, supply and demand, population, budget, tick-based updates |
| **Simulation** | Agent needs and schedules, time of day and calendar, growth and decay processes, emergent interaction, speed controls |
| **Card game** | Deck/hand/discard zones, shuffle, mana or cost curve, targeting, an effect resolution queue, opponent AI |
| **Survival** | Hunger/thirst/stamina/temperature, day-night cycle, gathering, crafting, base building, escalating threat |
| **Idle / incremental** | Big-number formatting, generators and multipliers, offline progress from timestamps, prestige, unlock cadence |
| **Puzzle** | Grid state, match or validity rules, cascade resolution, undo, level definitions or generation with guaranteed solvability |
| **Arcade** | Tight controls, score with multiplier, escalating spawn rate, high-score persistence, sub-second restart |
| **Roguelike / survivors-like** | Procedural waves, an upgrade draft on level-up, run-scoped progression, meta-progression, thousands of pooled entities |

When a request spans genres ("a farming RPG with tower defense at night"), build the union of the systems and let the state machine switch between modes.

### Inspired-by requests

When the user names an existing title, take **only the mechanics** — the systems, the loop, the feel. Everything expressive must be original: name, characters, art, story, music, and specific named content.

Mechanics are not protectable; expression is. So: no copyrighted character names or likenesses, no logos, no trademarked titles, no recreated level layouts, no lifted music. Give the game its own name and its own world. This is both a legal requirement and better work — an original skin on a proven loop is a game, while a knock-off is a knock-off.

Say what you did in one line: "Deck-based lane battler in the spirit of the genre, with an original setting and roster."

## Polish Checklist

Walk this before responding. Anything unchecked is unfinished work.

**Boots and runs**

- Opens from `file://` with no console errors and no network requests
- Canvas is crisp on retina; layout survives resize and orientation change
- No dependency on any external resource

**Complete**

- Title, options, how-to-play, HUD, pause and game-over/victory all present and functional
- Every button does something; no dead UI
- No TODOs, stubs, empty functions or unreachable code
- Every feature the user asked for is present

**Feels good**

- Input responds within one frame
- Hit-stop, screen shake and particles on significant events
- Eased transitions between all screens
- SFX on every meaningful action; music present and mixed below SFX
- Difficulty ramps: the first 30 seconds are winnable and the third minute is not

**Robust**

- Playable start to finish, with a natural end or an endless loop with a score
- Runs 3+ minutes without slowdown or a memory climb
- No way to get stuck, softlocked or out of bounds
- Rapid input, spam-clicking and window blur don't break state
- LocalStorage works, and failing LocalStorage doesn't crash the game

**Mobile**

- Touch controls work and are reachable one-handed
- No page scroll, zoom or text selection during play
- Readable on a 375px-wide screen

## Failure Handling

**When the request is huge** — an MMO, an open-world RPG, a full 4X — build the complete core loop at reduced content scale, and cut in this order: (1) visual fidelity, (2) content volume, (3) breadth of systems, (4) core mechanics. Cutting from the bottom of that list is what turns a game into a demo. Ten enemy types can become four; the combat system cannot become "click to win". State plainly what was scaled and what a next pass would add.

**When the request is vague** — "make me a game" — pick something with a strong loop, build it fully, and offer directions afterward. Never respond with a questionnaire; a finished game the user redirects beats a clarifying question every time.

**When something is genuinely impossible** in a single offline HTML file — real multiplayer, cloud saves, licensed assets, AAA-fidelity 3D — say so directly, then ship the closest real thing: local hot-seat or AI opponents instead of netplay, LocalStorage instead of cloud, original procedural art instead of licensed assets.

**When the file gets long:** that is expected. A complete game is 1500–4000 lines. Do not compress by deleting features, merging unrelated logic, or stripping comments. Write it in order and finish it.

**When a mechanic proves unstable** — jittery stacked physics, pathfinding that snags on corners — fix the algorithm rather than hiding the symptom. Substepping, position correction and proper broad-phase are all in `references/engine-patterns.md`.

## Internal Workflow

Work through these ten steps in order. Steps 1–4 are planning and should be brief and internal; the user wants a game, not a design document.

**1 · Analyse the request.** Identify genre, core fantasy ("I want to feel powerful / clever / in control"), session length, target platform, and any named inspiration. Fix the win and lose conditions now — an unclear ending produces a game that just stops. Decide the art direction: palette, shape language, mood.

**2 · Decompose into systems.** List every system the game needs — rendering, input, physics, AI, spawning, economy, UI, audio, particles, save. Mark each as core (the game is meaningless without it) or supporting. Note the dependencies — pathfinding needs the grid, combat needs collision — and build in dependency order.

**3 · Plan the architecture.** Choose the entity model (classes vs. component-ish objects), the update order (input → AI → physics → collision → resolution → effects → camera → render), the data structures (spatial hash? flow field? tile array?), and the save schema. Write the CONFIG block first — it forces you to decide the actual numbers before code depends on them.

**4 · Design the UI.** Sketch each screen and the HUD: what's shown, where it's anchored, how it responds. Decide the control scheme for keyboard, mouse and touch simultaneously so touch isn't retrofitted. Choose the palette and typography once, then apply them everywhere.

**5 · Build the rendering foundation.** Canvas setup with DPR scaling and resize handling, the fixed-timestep loop, the camera, layering, and the procedural art generation that produces sprites and tiles into offscreen canvases. Get a static scene drawing correctly on desktop and mobile before adding any behaviour — every later bug is easier to find when rendering is known-good.

**6 · Implement core mechanics.** The player first: movement, controls, and the primary verb (jump, shoot, place, drag, harvest). Tune it until it feels good in isolation — this is the single highest-leverage tuning in the project. Then the world it interacts with, then the primary opposition, then the loop that ties them together, then progression, economy and win/lose.

**7 · Add AI.** Give opponents state machines with clearly separable behaviours and visible telegraphs. Add pathfinding where units navigate. Tune aggression, reaction delay and accuracy as CONFIG values, and make sure they scale with difficulty. Good AI is *readable* — the player should be able to predict it well enough to outplay it. Perfect AI is not fun.

**8 · Add effects and juice.** Particles on every impact, spawn, death and pickup. Hit-stop and screen shake on significant hits. Damage numbers. Squash-and-stretch. Trails. Screen transitions. Then a full audio pass: every action gets a sound, then music, then the mix. This step is what people mean when they say a game feels "finished"; it is not optional decoration.

**9 · Optimise.** Pool the transient objects. Add the spatial hash if entity counts warrant it. Cache static layers. Cull off-screen work. Remove per-frame allocation. Then simulate the worst case — maximum entities, maximum particles — and confirm the frame budget holds. Add automatic degradation if it doesn't.

**10 · Verify before responding.** Trace the whole thing as a player would, honestly:

   - Load → menu → start → play → pause → resume → die → restart → quit to menu. Every path works.
   - Every button, key and touch target does what it claims.
   - Every declared feature exists and functions.
   - Win and lose are both reachable and both handled.
   - Save writes and reloads; a fresh profile also works.
   - No `TODO`, no empty handler, no undefined variable, no function defined twice, no reference to a sprite, sound or level that was never created.
   - Ten minutes of play produces no slowdown, no error, no softlock.

   If any check fails, fix it before responding. Shipping a broken game costs the user far more than the extra minutes cost you.

## Examples

**"Create a Clash Royale-inspired game."**
Real-time lane battler. Original setting — say, rival clockwork guilds — with an original card roster. Systems: elixir regeneration on a timer, an 8-card deck with a 4-card hand and a next-card queue, drag-to-deploy restricted to the player's half, two lanes plus a bridge, unit steering with local avoidance, target acquisition priorities (buildings vs. troops vs. air), three towers per side, a match timer with double-elixir overtime, and an opponent AI that banks elixir, counters recent deployments and pushes when ahead. Cards get distinct roles — swarm, tank, ranged, splash, spell — so counterplay exists. UI: deck bar with cost badges and cooldown fills, elixir bar, tower health, timer, victory/defeat with a crown count. Touch: drag a card onto the field with a valid-placement highlight.

**"Create an Angry Birds-inspired physics game."**
Slingshot puzzle with original characters and a distinct art direction. Systems: impulse-based rigid body physics with circles and boxes, restitution and friction, stable resting contacts via position correction and sleeping, destructible structures with per-material health (wood, stone and glass with different thresholds and debris), drag-to-aim with a dotted trajectory preview, projectile variants with a mid-flight ability (split, drop, dash), 12+ hand-designed levels of increasing complexity, three-star scoring on remaining ammo and structural damage, and a camera that follows the shot then pans back to the launch point. Effects: debris particles, dust on impact, splintering, chunky impact sounds. LocalStorage stores stars and unlocked levels.

**"Create a Vampire Survivors-style roguelike."**
Auto-attacking survival arena. Systems: WASD or joystick movement with weapons that fire automatically on their own cooldowns, endless scaling waves driven by a time-based spawn curve, 8+ enemy types with distinct movement (chaser, swarmer, charger, ranged, splitter, elite), XP gems that drop and magnet toward the player, a level-up draft of three upgrades from weapons and passives with evolution combos, thousands of entities handled with pooling plus a spatial hash, a 30-minute run structure with a boss, and meta-progression currency that persists between runs. This genre lives or dies on the power fantasy — the screen should be full of numbers and effects by minute 15 — so the particle system, damage numbers and cap-aware degradation matter more here than usual.

**"Create a Stardew Valley-inspired farming game."**
Cozy farming sim with an original valley, villagers and crops. Systems: a tile-based farm grid with till/plant/water/harvest states, a crop growth model driven by day ticks and watering, a day-night cycle with a stamina budget that ends the day, seasons that gate which crops grow, an inventory with stacking and a hotbar, a shop economy with buy and sell prices, NPCs with schedules and friendship-gated dialogue, tool upgrades, and a save system that writes on sleep. Art: warm palette, procedurally drawn tiles with per-tile variation so the farm doesn't look tiled. The loop is plan → act within stamina → sleep → see growth, so the end-of-day summary screen carries a lot of the satisfaction.

**"Create a Project Zomboid-style survival game."**
Top-down survival with an original setting. Systems: a procedurally generated town of buildings with interiors and lootable containers, needs simulation (hunger, thirst, fatigue, health, infection risk), an inventory with weight limits and equipment slots, melee and ranged combat with stamina cost and durability, enemy AI driven by sound and sight with a horde attraction system so noise genuinely matters, a day-night cycle with reduced visibility, base fortification with barricades and doors, crafting from scavenged parts, skill progression through use, and permadeath with a run summary. Tension here comes from information scarcity — a limited vision cone and audio cues for off-screen threats do more than any amount of gore.

## Best Practices

- **Build the whole loop first, then deepen it.** A rough version of every system beats a perfect version of one and stubs for the rest.
- **Tune the primary verb before anything else.** Movement, aiming or dragging is what the player does thousands of times. If it feels wrong, nothing downstream saves it.
- **Put every number in CONFIG.** It makes balancing possible and makes the file modifiable by the user afterwards.
- **Add juice as you go,** not as a final pass — it changes how you tune everything else.
- **Prefer readable AI over strong AI.** Telegraphs, wind-ups and predictable patterns make a game feel fair and skilful.
- **Generate art with variation.** Procedural sprites with per-instance seeds — slight colour, size and shape jitter — look hand-made; identical clones look cheap.
- **Give the game a name, a title screen and a colour identity.** It costs twenty lines and changes the entire impression.
- **Write the save system early.** Retrofitting persistence into finished game state is far more work.
- **Test with the window blurred, resized and spammed with input.** That's where state bugs live.
- **When in doubt about scope, ship more game and simpler visuals.** Players forgive plain graphics; they don't forgive a game with nothing to do.
