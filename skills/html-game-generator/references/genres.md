# Genre Playbooks

For each genre: the systems that are non-negotiable, the core loop, the numbers that need tuning, and the specific mistakes that make generated games in that genre feel wrong.

Read the entry that matches the request before planning the architecture. If the request spans two genres, read both and build the union.

Contents:
[Platformer](#platformer) · [Tower defense](#tower-defense) · [RTS / lane battler](#rts--lane-battler) · [Racing](#racing) · [RPG](#rpg) · [Physics / projectile](#physics--projectile) · [City builder / management](#city-builder--management) · [Simulation](#simulation) · [Card game](#card-game) · [Survival](#survival) · [Idle / incremental](#idle--incremental) · [Puzzle](#puzzle) · [Arcade](#arcade) · [Roguelike / survivors-like](#roguelike--survivors-like) · [Farming / life sim](#farming--life-sim) · [Shared content targets](#shared-content-targets)

---

## Platformer

**Loop:** traverse → hazard or enemy → precise input → checkpoint → harder traversal.

**Required systems:** tilemap with per-axis collision, the full jump feel package (coyote time, jump buffering, variable height, apex gravity reduction), camera with look-ahead and world clamping, hazards, moving platforms, collectibles, checkpoints, level progression.

**Tuning that decides everything:** gravity ~2200 px/s², jump velocity ~-620, max run ~300, ground acceleration ~2400, air control ~40% of ground, coyote 0.1s, buffer 0.12s. Jump apex should land around 0.35–0.45s. Tune the jump before building a single level.

**Content target:** 8–15 levels or one large connected map, 4+ hazard types, 3+ enemy behaviours, 2+ platform types (moving, crumbling, one-way).

**Mistakes to avoid:** resolving both axes at once (the player snags on tile seams); no coyote time (feels unresponsive and unfair); a camera that snaps rather than lerps (nauseating); one-way platforms without a drop-through input; instant-death spikes with no telegraph.

---

## Tower defense

**Loop:** survey the path → spend on placement → watch the wave → earn → upgrade → harder wave.

**Required systems:** fixed path (waypoints) or flow field, a wave scheduler with composition tables, a placement grid with validity checks and a build ghost, tower targeting with selectable priorities (first / last / strongest / closest), projectile travel with target leading, an economy, upgrade and sell, lives, and a between-waves phase.

**Tuning:** early towers cost ~40% of starting gold; each upgrade tier costs 1.6–2× the previous for ~1.8× value; enemy HP scales ~1.15× per wave with an armour type introduced every 5 waves. The player should be able to lose by wave 12 if they build badly and win by wave 25 if they build well.

**Content target:** 6+ tower types with genuinely different roles (single-target DPS, splash, slow, chain, support aura, anti-air), 8+ enemy types (fast/swarm, armoured, healer, shielded, flying, boss), 20+ waves, 2+ maps.

**Mistakes to avoid:** towers that all just shoot faster (no strategy); no build ghost or range preview (placement becomes guesswork); projectiles that don't lead their target (fast enemies become immune); no wave preview (the player can't plan); allowing full path blocking without a maze rule.

---

## RTS / lane battler

**Loop:** accumulate resource → choose a unit → deploy → the fight resolves → react to the counter-push.

**Required systems:** resource generation on a timer, a unit roster with rock-paper-scissors relationships, deploy input (drag-and-drop or select-and-click), pathfinding or lane following, local avoidance so units don't stack, target acquisition with priorities, attack ranges and cooldowns, towers or bases with HP, a match timer with an overtime mechanic, and an opponent AI.

**Opponent AI that actually feels like a player:** bank resources rather than spending instantly, respond to what the player just deployed with an appropriate counter, push when ahead on resources, defend when behind, and vary the reaction delay with difficulty (0.2s hard, 1.5s easy). An AI that plays perfectly is not fun; an AI that plays *legibly* is.

**Tuning:** resource regenerates roughly one unit's cost every 3–4 seconds; a match runs 2–4 minutes; the cheapest unit costs 1/5 of the most expensive.

**Content target:** 10+ units across swarm / tank / ranged / splash / flying / support / spell roles, 3 structures per side, 2+ lanes.

**Mistakes to avoid:** units that walk into each other and stop (missing separation steering); no counter relationships (one unit dominates); the opponent deploying instantly at full information (unbeatable and unreadable); no deploy-zone restriction (removes all positional tension).

---

## Racing

**Loop:** learn the line → push the limit → recover from mistakes → beat the lap or the rival.

**Required systems:** track representation (spline or tile), a car model with throttle, brake, steering, grip and drift, lap and checkpoint validation (which prevents cutting), rival AI following racing lines with rubber-banding, a lap timer with splits and a best-lap record, a minimap, and a countdown start.

**Car feel:** separate longitudinal and lateral velocity. Grip falls off past a slip threshold, producing drift. Steering authority decreases with speed. Add a slight camera pull-back and FOV-ish zoom with speed — it is most of the sensation of speed.

**Tuning:** a lap should take 30–70 seconds. Top speed reached in ~4 seconds. The AI's best lap should be about 3% faster than a competent player's.

**Content target:** 3+ tracks with distinct character, 3+ vehicles with real trade-offs (speed vs. grip vs. acceleration), 4+ rivals, time trial plus race modes.

**Mistakes to avoid:** no checkpoint validation (players cut the whole track); AI that drives on rails and can't be overtaken; no sense of speed (add speed lines, camera shake at high speed, particle wake); braking that feels like the handbrake.

---

## RPG

**Loop:** explore → encounter → fight with resources → loot and level → get stronger → tougher region.

**Required systems:** stats (HP, MP/stamina, attack, defense, speed) with a level curve, combat (turn-based with an initiative order, or action-based with hitboxes and i-frames), inventory with equipment slots and stat modifiers, a shop economy, NPCs with dialogue trees, a quest system with objective tracking, a world map with zones, enemy scaling by region, and saves.

**Tuning:** XP to next level ~ `100 * level^1.5`. A boss should take 6–10 exchanges. Healing items should be scarce enough to matter. Damage formula `atk * (100/(100+def))` scales cleanly without becoming trivial.

**Content target:** 4+ zones, 12+ enemy types, 3 bosses, 20+ items, 6+ abilities with distinct uses, a main quest and 3+ side quests.

**Mistakes to avoid:** combat that reduces to "press attack" (give abilities real trade-offs); a dialogue system with no choices; equipment that is strictly linear (each piece should trade something); no fast travel in a large world; unsaveable progress.

---

## Physics / projectile

**Loop:** observe the structure → aim → launch → watch the collapse → adjust and retry.

**Required systems:** an impulse or verlet solver with position correction and sleeping, materials with different densities and break thresholds, destructible structures that fragment, drag-to-aim with a dotted trajectory preview, projectile variants with a mid-flight ability, a level definition format, star scoring, and a camera that follows the projectile then returns.

**Stability:** 8–10 solver iterations, 0.4 positional correction with 0.02 slop, sleeping below an energy threshold, and velocity clamping. Without these, stacks jitter and slowly sink — the single most visible failure in generated physics games.

**Tuning:** the first shot should almost solve level 1. Three stars should require efficiency, not luck. Levels should teach one new idea each.

**Content target:** 12+ levels, 3+ projectile types, 3+ materials, 2+ enemy/target types.

**Mistakes to avoid:** no trajectory preview (aiming becomes a lottery); structures that don't visibly break apart; no slow-motion on a big collapse (this is the payoff moment); levels solvable by firing at the same spot every time.

---

## City builder / management

**Loop:** assess needs → place a building → resources flow → new bottleneck → expand.

**Required systems:** a tile grid with terrain types, placement with validity and adjacency rules, a resource flow simulation on a tick, supply and demand per resource, population with needs and satisfaction, a budget with income and upkeep, zoning or building categories, a demolish tool, and a speed control with pause.

**Tuning:** a tick every 1–2 seconds at normal speed. Each building should pay back in 60–120 seconds. Growth should be steady enough to feel alive but slow enough that decisions matter.

**Content target:** 12+ building types across 4 categories, 5+ resources, 3+ terrain types, disasters or events, win/goal conditions or an endless sandbox with milestones.

**Mistakes to avoid:** no feedback on why a placement is invalid; resources that never become scarce (removes all decision-making); no overview of what's failing (add per-resource indicators and a problem list); UI that requires memorising costs.

---

## Simulation

**Loop:** set up conditions → observe emergent behaviour → intervene → observe consequences.

**Required systems:** agents with needs that decay, schedules or utility-based decision making, a time system (hour, day, season) with speed controls, growth and decay processes, agent-to-agent interaction, an inspection UI for individual agents, and statistics or graphs.

**Utility AI beats state machines here:** score every possible action against current needs and pick the highest. It produces believable, non-repetitive behaviour from very little code.

**Tuning:** a full day in 3–8 real minutes. Needs should decay fast enough that neglect has visible consequences within one day.

**Content target:** 6+ agent needs, 8+ interactable objects, a full day-night and seasonal cycle, at least one emergent interaction the player can discover.

**Mistakes to avoid:** agents that all behave identically (add per-agent trait variance); no way to inspect why an agent did something (an activity log fixes this); simulation so slow nothing appears to happen; no pause.

---

## Card game

**Loop:** draw → assess board → play within cost → resolve → opponent responds.

**Required systems:** zones (deck, hand, board, discard, exhaust), shuffle with a seeded RNG, a cost/mana curve, targeting with valid-target highlighting, an effect resolution queue (so chains and triggers resolve in a defined order), turn phases, an opponent AI, a win condition, and deck building or a fixed deck per run.

**Effects as data, not code:** `{ type:'damage', amount:3, target:'enemy' }` interpreted by a resolver. Hard-coding each card's behaviour makes 30 cards unmaintainable and 60 impossible.

**Tuning:** hand size 5–7, mana curve peaking at 3, a game lasting 8–15 turns. Every card must have a situation where it is the best play.

**Content target:** 30+ cards across 4+ archetypes, 5+ keyword mechanics, an opponent with a coherent strategy, a run or ladder structure.

**Mistakes to avoid:** no animation on card play (the board becomes unreadable); an AI that plays its highest-cost card every turn; no explanation of what a keyword means (add hover tooltips); resolution order that isn't visible to the player.

---

## Survival

**Loop:** scavenge → manage needs → craft → fortify → survive an escalating threat.

**Required systems:** needs (hunger, thirst, fatigue, health, temperature) with decay rates, a day-night cycle affecting visibility and danger, resource nodes and lootable containers, an inventory with weight limits, crafting with recipes and stations, base building, combat with stamina and durability, threat AI driven by sound and sight, and permadeath with a run summary.

**Sound as a mechanic:** every action emits a noise radius that attracts enemies. It is what makes survival games tense rather than just grindy, and it's cheap to implement.

**Tuning:** hunger empties in ~2 in-game days, thirst in ~1. Night should be genuinely dangerous. Threat density should climb every few days so a stable base eventually stops being safe.

**Content target:** 5+ needs, 20+ items, 15+ recipes, 4+ enemy types, day-night with weather, a skill progression, 3+ building pieces.

**Mistakes to avoid:** needs that decay so fast the game is only eating; no way to see what's about to kill you; crafting menus that don't show what's missing; an infinite safe zone (removes all tension).

---

## Idle / incremental

**Loop:** buy a generator → watch numbers rise → afford a better one → hit a wall → prestige.

**Required systems:** big-number formatting (K/M/B/T then scientific), generators with cost scaling, multipliers and synergies, offline progress from a timestamp, prestige with a permanent currency, an unlock cadence, achievements, and frequent autosave.

**Cost scaling:** `cost = base * growth^owned` with growth 1.07–1.15. Production scaling should slightly outpace cost early and fall behind later — that gap is what creates the wall that makes prestige feel earned.

**Tuning:** something to click or buy within the first 5 seconds. A meaningful purchase every 10–30 seconds early on. First prestige at 20–40 minutes.

**Content target:** 8+ generators, 20+ upgrades, 2 prestige layers, 15+ achievements, offline progress capped at 8 hours.

**Mistakes to avoid:** numbers that overflow into `Infinity` (use a mantissa/exponent pair past 1e308); no offline progress (the genre requires it); nothing to do but wait; a prestige that isn't clearly worth it.

---

## Puzzle

**Loop:** read the board → find the move → execute → cascade → new board state.

**Required systems:** grid state with validity rules, move input (swap, drag, rotate, place), match or solve detection, cascade resolution with animation, an undo stack, a hint system, level definitions or generation with **guaranteed solvability**, and star or move-count scoring.

**Solvability is mandatory.** Every generated board must be verified solvable before it is shown — solve it programmatically, or generate it backwards from a solved state by applying legal inverse moves. An unsolvable puzzle is the worst possible bug in this genre.

**Tuning:** the first five levels teach mechanics with no failure possible. Difficulty should climb in a sawtooth (hard level, easier level, harder level) rather than monotonically.

**Content target:** 20+ levels or endless generation, 3+ mechanics introduced across the progression, undo, hints, and star scoring.

**Mistakes to avoid:** no cascade animation (the player can't follow what happened); no undo; no shuffle when no moves remain; hints that just solve the level.

---

## Arcade

**Loop:** survive → score → escalate → die → immediately retry.

**Required systems:** very tight controls, an escalating spawn or speed curve, scoring with a multiplier and combo timer, high-score persistence, a sub-second restart, and screen-filling feedback on every event.

**Tuning:** first death around 30–60 seconds for a new player. Escalation should be continuous rather than in visible steps. Restart must be a single key with no menus in the way — the "one more go" loop dies if restarting takes three seconds.

**Content target:** one perfectly tuned mechanic, 4+ obstacle or enemy types introduced over time, a combo or multiplier system, a local high-score table.

**Mistakes to avoid:** input lag of any kind; unfair off-screen deaths; a restart flow with confirmation dialogs; difficulty that plateaus.

---

## Roguelike / survivors-like

**Loop:** survive waves → collect XP → draft an upgrade → get stronger → face denser waves → die → spend meta-currency.

**Required systems:** a time-based spawn director, many enemy archetypes with distinct movement, XP drops with a magnet radius, a level-up draft (3 choices from weapons and passives), weapon evolution combos, aggressive pooling plus a spatial hash, a boss at intervals, a run timer, and meta-progression that persists.

**The power curve is the whole game.** Minute 1 should feel dangerous; minute 15 should feel overwhelming in the player's favour. If the player isn't clearing the screen automatically by the end, the upgrades aren't scaling enough.

**Tuning:** enemy count grows ~1.06× per 30 seconds. XP requirement `10 * level^1.4`. A run lasts 20–30 minutes. Each upgrade should be worth roughly 15–25% power.

**Content target:** 8+ enemy types, 8+ weapons with evolutions, 10+ passives, 2+ bosses, meta-progression with 10+ purchasable permanent upgrades.

**Mistakes to avoid:** framerate collapse at high entity counts (pool and hash from the start, not as a fix later); upgrade choices that are all numerically identical; no visual escalation (the screen should look increasingly absurd); enemies that spawn on top of the player.

---

## Farming / life sim

**Loop:** plan the day → spend stamina on actions → sleep → see growth → sell → invest.

**Required systems:** a tile farm grid with soil states (untilled, tilled, watered, planted, grown), crop growth by day tick, a stamina budget that forces prioritisation, a day-night cycle with a forced sleep, seasons gating crops, an inventory with a hotbar, a shop economy, NPCs with schedules and friendship, tool upgrades, and a save on sleep.

**The satisfaction is in the summary.** An end-of-day screen showing what grew, what was earned and what's ready tomorrow carries a surprising amount of the loop's reward.

**Tuning:** a crop takes 4–8 days. A day is 8–12 real minutes. Stamina allows roughly 30–50 actions. Early crops should return ~2× their seed cost; later ones ~4×, with longer growth.

**Content target:** 12+ crops across 4 seasons, 6+ tools with upgrade tiers, 5+ NPCs with dialogue and gift preferences, a shop, 3+ farm expansions or buildings.

**Mistakes to avoid:** no stamina limit (removes all planning); crops that grow in real time rather than day ticks (the player just waits); no indication of what's ready to harvest; NPCs that stand still all day.

---

## Shared content targets

Regardless of genre, a finished game has:

- **A named title screen** with a colour identity and at least one animated element
- **A how-to-play panel** listing every control for keyboard, mouse and touch
- **An options panel** with master/SFX/music volume and a reduced-motion toggle
- **A pause** that can be reached with one key and that visibly stops the world
- **A game-over or victory screen** with a stat summary and one-key restart
- **At least 10–20 minutes of distinct content** before the player has seen everything
- **A difficulty curve** with a comfortable opening and a genuine challenge by the midpoint
- **Persistence** of whatever progression exists — high score at minimum

If any of these is missing, the game isn't finished, regardless of how good the core mechanic is.
