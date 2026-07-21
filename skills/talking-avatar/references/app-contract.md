# Realtime talking-avatar app contract

## Stack

Use Next.js or vinext by default because the app needs a same-origin server route for Realtime session negotiation. Preserve an existing working stack. The starter templates assume React, TypeScript, Tailwind CSS v4, Framer Motion, and Phosphor icons.

Verify current OpenAI Realtime documentation before implementation. The bundled route is a known working shape, not a permanent API specification.

## File contract

The starter produces:

```text
app/TalkingAvatarApp.tsx
app/api/realtime/session/route.ts
app/globals.css
app/layout.tsx
app/page.tsx
tests/talking-avatar.test.mjs
public/avatar/avatar-base.jpg        # generated separately
public/avatar/mouth-soft.png         # generated/cropped separately
public/avatar/mouth-round.png
public/avatar/mouth-open.png
```

## BYOK negotiation

1. Collect the key in a password input after explicit user entry.
2. Request microphone permission from the connect action.
3. Create `RTCPeerConnection`, microphone track, and data channel.
4. POST the local SDP to the same-origin server route with the key in a request header.
5. The server validates shape and size, forwards SDP plus session configuration to the verified OpenAI Realtime call endpoint, and returns SDP only.
6. Clear the key from component state immediately after the remote description is accepted.
7. Never log the key, upstream body, SDP, or full error response.

## Realtime event map

- `input_audio_buffer.speech_started` → listening
- `input_audio_buffer.speech_stopped` → thinking
- input transcription completed → append user transcript
- output audio/text transcript delta → append assistant transcript
- output audio delta → speaking state only
- response done → ready and surface failures
- error → inline room error

Use the remote audio analyzer for mouth timing regardless of these state labels.

## Interaction contract

- One avatar, transcript, typed composer, mic mute, speaker mute, and disconnect.
- Generate a short greeting after the data channel opens.
- Allow interruption through the Realtime turn-detection configuration.
- Stop tracks, close peer/data channel/audio context, cancel animation frames, and reset mouth to closed on disconnect or unmount.
- Use `min-height: 100dvh`; collapse to avatar then transcript on mobile.
- Keep the avatar image itself static. Ambient status indicators may animate, but not the face or body.

## Test contract

- Server-rendered key gate contains app name, character name, model, and key input.
- Session route rejects missing keys.
- Source contains no `localStorage`, `sessionStorage`, or `indexedDB` key persistence.
- Route contains no console logging and emits `Cache-Control: no-store`.
- Source contains `createAnalyser`, `getByteTimeDomainData`, `requestAnimationFrame`, a 90–110 ms pose interval, and adjacent pose stepping.
- Styles contain no canned `@keyframes mouth-*` animation.
- Asset validator passes before build.
