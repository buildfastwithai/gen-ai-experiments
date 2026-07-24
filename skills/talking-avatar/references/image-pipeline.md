# Avatar image pipeline

## Contents

- Canonical portrait
- Mouth edits
- Cropping and alignment
- Acceptance criteria

## Canonical portrait

For photo mode, inspect the local image first and use it as the identity reference. For description mode, generate the canonical image directly from the normalized character brief.

Use this prompt shape:

```text
Use case: identity-preserve (photo mode) or stylized-concept/photorealistic-natural (description mode)
Asset type: canonical talking-avatar base frame
Primary request: Create a front-facing portrait of <character> with a relaxed neutral expression and naturally closed lips.
Composition: portrait 4:5, eye-level camera, centered head, upright posture, level shoulders, hands out of frame.
Lighting: soft, even frontal light with readable lips and no hard shadow across the mouth.
Constraints: lock identity, gaze, hair, face shape, facial hair, glasses, canvas, crop, pose, clothing, background, and lighting. Closed mouth; no teeth.
Avoid: head tilt, asymmetric expression, dramatic lighting, props, text, watermark, cropped hair.
```

Use a simple background and clothing because these pixels must remain fixed. Do not add scene or wardrobe variants by default.

## Mouth edits

Issue one image generation call per frame. Always reference the canonical frame and repeat the invariants.

### Soft

```text
Change only the immediate lips and tiny inner-mouth opening. Part the lips slightly as for a quiet consonant-vowel sound. Keep every pixel outside the mouth region compositionally identical: canvas, crop, identity, eyes, brows, glasses, hair, nose, cheeks, jaw, beard, neck, shoulders, clothing, background, lighting, and shadows. No head or jaw movement.
```

### Round

```text
Change only the immediate lips and inner mouth to a natural rounded “oh” shape. Keep the opening conversational, not surprised. Preserve all canonical invariants; do not move the jaw, chin, beard, or mustache outside the lip region.
```

### Open

```text
Change only the immediate lips and inner mouth to a natural medium-open “eh/ah” talking shape. A small amount of teeth may show. Preserve all canonical invariants; do not broaden the smile or move the head, cheeks, jaw, facial hair, clothing, or background.
```

## Cropping and alignment

1. Verify every generated frame has the same canvas size as the canonical image.
2. Locate a rectangle that contains the full extent of every generated mouth plus a narrow ring of surrounding skin.
3. Use identical integer crop coordinates for `soft`, `round`, and `open`.
4. Record relative placement:

```text
left% = crop_x / canonical_width * 100
top% = crop_y / canonical_height * 100
width% = crop_width / canonical_width * 100
height% = crop_height / canonical_height * 100
```

5. Position the mouth window with those percentages inside an uncropped canonical image.
6. Feather only the patch edge with a compact elliptical CSS mask. If the neutral mouth remains visible as a double image, tighten the crop or increase the opaque center; do not enlarge the patch across the jaw.
7. Cache-bust revised sprite URLs when replacing deployed assets.

The crop is deterministic post-processing, not a substitute for identity-preserving image edits.

## Acceptance criteria

- All speech patches have identical dimensions.
- The mustache, beard, chin, and cheeks do not jump between poses.
- No eye, glasses, head, neck, shoulder, clothing, or background pixels change during speech.
- The closed state uses the canonical image with no overlay.
- A speech patch is small relative to the portrait and remains aligned at every responsive size.
