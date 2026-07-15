---
name: talking-avatar
description: Build or transform lightweight realtime voice-chat apps with a talking character avatar from either a user-supplied photograph or a text description. Use when Codex is asked to create a talking avatar, photo avatar, character chatbot, roleplaying voice companion, mouth-sprite animation, or reusable OpenAI Realtime avatar app in Vite/Next.js, including BYOK API-key intake, identity-consistent image generation, audio-driven lip sync, testing, and deployment.
---

# Talking Avatar

Create one focused voice conversation with a fixed character portrait whose mouth poses follow the actual remote audio. Accept either a photograph or a character description, generate a canonical portrait plus small mouth sprites, and build the app around OpenAI Realtime.

## Coordinate the required skills

- Use `imagegen` for every canonical portrait or mouth-frame generation/edit. Read its full instructions before generating.
- Use `openai-docs` and, when applicable, `openai-platform-api-key` to verify the current Realtime WebRTC endpoint, session schema, model, voices, and credential flow. Never rely on this skill's model examples as current truth.
- Use the available frontend design skill for interface work.
- If `.openai/hosting.json` exists, follow `sites-building` and `sites-hosting` through deployment.
- Do not add backgrounds, wardrobes, role modes, or multiple characters unless the user explicitly asks. The default product is one avatar and one conversation.

## Choose the input path

1. **Photograph supplied:** inspect it with `view_image`, treat it as an identity reference, and preserve face shape, skin tone, hair, glasses, facial hair, and distinguishing features.
2. **Character described:** normalize the description into a concrete visual spec. Ask only for a missing detail that materially changes identity, such as photorealistic versus illustrated. Otherwise proceed with tasteful defaults.
3. Establish the character name, concise persona, app name, language, and preferred voice. Infer reasonable defaults when safe.

Read [references/image-pipeline.md](references/image-pipeline.md) before creating or editing the avatar assets.

## Build the asset set

1. Generate one canonical, front-facing, evenly lit, closed-mouth portrait. Lock its canvas, crop, head position, gaze, pose, clothing, background, and lighting.
2. From that canonical image, generate three separate identity-preserving edits:
   - `soft`: lips slightly parted;
   - `round`: a natural rounded vowel;
   - `open`: a natural medium-open vowel.
3. Repeat the invariants in every edit prompt. Change only the immediate lips and inner mouth. Reject frames with moved eyes, jaw, glasses, head, beard, clothing, or lighting.
4. Crop the smallest practical identical rectangle from all three speech frames. Keep enough surrounding skin for feathering, but do not ship full-frame speech images.
5. Save exactly these project assets by default:
   - `public/avatar/avatar-base.jpg`
   - `public/avatar/mouth-soft.png`
   - `public/avatar/mouth-round.png`
   - `public/avatar/mouth-open.png`
6. Run `scripts/validate_avatar_assets.py --dir <project>/public/avatar` and fix all failures.

Never animate the complete portrait. Only replace the mouth patch.

## Build or integrate the app

Prefer an existing working stack. For a new project, use Next.js or vinext because the user's API key must cross a server route; use plain Vite only when a safe backend already exists.

For a compatible new Next/vinext project, scaffold the proven core:

```bash
python3 <skill-dir>/scripts/scaffold_app.py \
  --target <project-dir> \
  --character-name "Mira" \
  --app-name "Mira Live" \
  --persona "a concise, curious field researcher" \
  --model "<verified-realtime-model>" \
  --transcription-model "<verified-transcription-model>" \
  --voice "<verified-realtime-voice>"
```

The target must already contain the framework configuration and dependencies. Install `framer-motion` and `@phosphor-icons/react` when missing. Use `--force` only for a newly initialized project after inspecting the files it will replace. For an existing product, copy or adapt individual files from `assets/starter/` instead of overwriting its architecture.

Read [references/app-contract.md](references/app-contract.md) before changing the Realtime route, API-key flow, or event handling.

## Implement natural lip sync

Read [references/realtime-lipsync.md](references/realtime-lipsync.md) and preserve its behavioral contract:

- Analyze the remote output `MediaStream`, not microphone input and not Realtime event cadence.
- Sample audio every animation frame without updating React state.
- Update the visible mouth pose no faster than about every 96 ms.
- Smooth attack and decay, normalize against a rolling peak, and close after short silence.
- Move through adjacent poses (`closed → soft → round → open`) instead of jumping.
- Set a DOM `data-mouth` attribute and let CSS reveal exactly one patch.
- Keep the portrait pixels completely static.

Do not use a canned infinite mouth animation. `response.output_audio.delta` identifies speaking state but does not provide lip timing.

## Preserve the BYOK security boundary

- Ask the user to enter the OpenAI API key inside the app.
- Keep the key in component memory only; never use local storage, session storage, IndexedDB, analytics, logs, or source files.
- Send it once to the same-origin session route over HTTPS, clear client state after negotiation, and return `Cache-Control: no-store`.
- Never expose a long-lived key directly to the Realtime WebRTC peer connection.
- Map upstream authentication and rate-limit failures to short user-facing errors without echoing response bodies or secrets.

## Validate before handoff

1. Run the production build.
2. Run lint and the starter regression test when available.
3. Confirm the source contains an `AnalyserNode`, `requestAnimationFrame`, a 90–110 ms pose interval, adjacent-pose stepping, and no CSS `@keyframes mouth-*` loop.
4. Confirm all mouth patches have identical dimensions and align over the canonical mouth at desktop and mobile sizes.
5. Confirm only the mouth changes during speech; blinking, head bobbing, pose drift, and full-frame swaps are failures.
6. Confirm mic mute, speaker mute, interruption, transcript deltas, typed messages, disconnect cleanup, audio-context cleanup, empty state, connection errors, and invalid-key errors.
7. If the user requests visual browser QA, test a live voice turn and tune timing from observed speech. Otherwise do not claim that browser-level lip sync was visually verified.
8. Deploy when requested or when the active hosting skill requires it, then return the live URL.

## Deliverables

Return the runnable app, the final avatar asset paths, the generation prompt set, whether photo or description mode was used, the Realtime model/voice verified for that run, validation results, and the deployed URL when applicable.
