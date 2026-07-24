# Natural remote-audio lip sync

## Contract

Drive mouth poses from the decoded remote audio stream. Realtime server events indicate response state, not acoustic timing, so never use event arrival or a fixed CSS loop as lip sync.

## Audio graph

```text
remote MediaStream → MediaStreamAudioSourceNode → AnalyserNode → zero-gain sink → AudioContext.destination
remote MediaStream → HTMLAudioElement (audible playback)
```

The zero-gain path keeps the analysis graph active without duplicating audible playback. Close and disconnect every node when leaving the room.

## Proven timing baseline

- `AnalyserNode.fftSize = 256`
- `smoothingTimeConstant = 0.45`
- sample every `requestAnimationFrame`
- visible pose interval: `96 ms` (about 10.4 fps)
- envelope attack coefficient: `0.38`
- envelope decay coefficient: `0.12`
- rolling-peak decay: `0.997`
- silence RMS threshold: approximately `0.013`
- begin targeting closed after `120 ms` silence
- force closed after approximately `170 ms` silence

Treat these as tuned starting values. Keep visible pose updates between 90 and 110 ms unless observed speech demonstrates a need to change them.

## Adaptive envelope

```ts
const ease = rms >= envelope ? 0.38 : 0.12;
envelope += (rms - envelope) * ease;
rollingPeak = Math.max(envelope, rollingPeak * 0.997, 0.035);
const level = clamp((envelope - 0.012) / Math.max(rollingPeak - 0.012, 0.025));
```

Accumulate the strongest normalized level between visible pose updates. A useful starting quantization is:

- `< 0.12`: closed
- `< 0.40`: soft
- `< 0.78`: round
- otherwise: open

## Natural pose stepping

Maintain `closed, soft, round, open` as an ordered pose list. At each visible update, move by at most one index toward the target:

```ts
nextIndex = currentIndex + Math.sign(targetIndex - currentIndex);
```

After prolonged silence, jump directly to closed. This prevents flutter while allowing a decisive stop.

## Rendering rule

Write `data-mouth="closed|soft|round|open"` directly on a mouth-window DOM node. CSS must reveal exactly one patch. Do not place the per-frame audio level in React state; 60 React renders per second are unnecessary and can destabilize mobile playback.

## Tuning symptoms

- **Mechanical flutter:** increase pose interval toward 105 ms, slow decay, or require adjacent stepping.
- **Feels delayed:** decrease interval toward 90 ms or increase attack; do not remove the cadence cap.
- **Never opens fully:** lower the open threshold or make rolling peak adapt faster.
- **Mouth hangs open:** lower decay time or shorten silence close thresholds.
- **Double lips/seams:** fix crop/mask alignment; timing changes cannot solve an asset seam.
- **Moves while user speaks:** analyzer is connected to microphone input; reconnect it to the remote output stream.
