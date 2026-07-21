# Image system

Use original imagery only when it carries product truth or the chosen art direction. Prefer HTML/CSS for typography, diagrams, labels, and simple shapes.

## Shot plan

Freeze a small table before generating:

| Asset | Purpose | Aspect tendency | Product state | Composition |
| --- | --- | --- | --- | --- |
| Hero | Explain the concept emotionally | Landscape | Hero product in use or iconic still life | Reserve copy-safe space |
| Product cards | Compare and shop | Square or portrait | One accurate product per image | Consistent angle and scale |
| Editorial/process | Prove origin or mechanism | Landscape or portrait | Material, maker, or process | Show information unavailable elsewhere |
| Social card | Earn the click | Landscape | Hero product + exact concise message | Legible at thumbnail size |

Do not generate an editorial/process image if the brief provides no truthful process to depict.

## Continuity lock

Repeat these invariants in every product-image prompt:

- product construction, materials, silhouette, and functional parts;
- camera family and framing logic;
- backdrop behavior and lighting family;
- palette roles;
- realism or illustration level;
- forbidden props, logos, text, people, and artifacts.

Vary only the product colorway, product-specific feature, background color within the system, and camera angle when planned.

## Prompt structure

Use the ImageGen skill's current prompt schema. Supply at least:

```text
Use case: product-mockup
Asset type: <hero or product-card role>
Primary request: <accurate product and the creative thesis>
Scene/backdrop: <specific set>
Style/medium: <photographic or illustrative treatment>
Composition/framing: <aspect intent, crop, angle, copy space>
Lighting/mood: <specific lighting behavior>
Color palette: <roles, not a long color list>
Materials/textures: <product-critical surfaces>
Constraints: <accuracy and continuity invariants>
Avoid: <likely failures and generic styling>
```

For the hero, state which side needs negative space. For catalog images, request exactly one product, generous edge clearance, and a consistent angle. Do not request transparent output for reflective, glass, liquid, smoke, hair, or other complex edges unless the ImageGen skill's supported transparency workflow is explicitly chosen.

## Product accuracy review

Inspect every output for:

- wrong material boundaries or colorways;
- missing, doubled, or unusable handles, closures, straps, feet, labels, or controls;
- impossible reflections, liquid levels, shadows, or contact points;
- extra products or props;
- inconsistent camera angle or scale across a catalog set;
- unintended text, logos, signatures, or watermarks;
- incorrect exact text on a social card.

Retry once with one targeted correction when an output is close. Regenerate from a tighter prompt when the underlying product logic is wrong.

## Workspace handling

Use built-in ImageGen by default. After approval or selection, copy each final project asset from ImageGen's generated-images location into a stable workspace path such as `public/products/`. Use descriptive filenames. Keep source and final social image in the workspace. Update the consuming code only after the asset exists.

## Social card

Generate exactly one cohesive social card after the site has a stable name, headline, palette, photography treatment, and signature device. Include only exact short text. Inspect spelling and omit the image metadata if the generated typography is unusable after the single allowed retry.
