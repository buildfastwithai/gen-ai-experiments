# Effect Recipes

Tested implementations for the visual treatments that are hard to get right from memory. Copy and tune the numbers to match the screenshot.

Contents:
1. [Glassmorphism](#glassmorphism)
2. [Neumorphism](#neumorphism)
3. [Gradients](#gradients)
4. [Gradient text](#gradient-text)
5. [Gradient borders](#gradient-borders)
6. [Glow](#glow)
7. [Layered shadows](#layered-shadows)
8. [Mesh and blob backgrounds](#mesh-and-blob-backgrounds)
9. [Grid and dot patterns](#grid-and-dot-patterns)
10. [Noise texture](#noise-texture)
11. [Masks and fades](#masks-and-fades)
12. [Animations](#animations)
13. [Hover treatments](#hover-treatments)
14. [Reduced motion](#reduced-motion)

---

## Glassmorphism

Frosted panel over a busy or colorful background. Three ingredients: translucent background, backdrop blur, and a light border. The border is what sells it — without it the panel reads as flat translucency.

```html
<!-- light -->
<div class="rounded-2xl border border-white/20 bg-white/70 shadow-lg backdrop-blur-xl">

<!-- dark -->
<div class="rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl
            shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">

<!-- sticky glass navbar -->
<header class="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl backdrop-saturate-150">
```

Blur strength: `backdrop-blur-sm` (4px) barely reads; `backdrop-blur-xl` (24px) is the typical "glass" look. Add `backdrop-saturate-150` when the backdrop is colorful — it keeps the color alive through the blur.

Glass only works over something. On a flat background it looks like a plain tinted box.

## Neumorphism

Soft extruded shapes on a mid-tone background of the *same* hue as the element. Light shadow up-left, dark shadow down-right.

```html
<!-- raised -->
<div class="rounded-2xl bg-[#E0E5EC] p-6
            shadow-[6px_6px_12px_rgba(163,177,198,0.6),-6px_-6px_12px_rgba(255,255,255,0.9)]">

<!-- pressed / inset -->
<div class="rounded-2xl bg-[#E0E5EC] p-6
            shadow-[inset_4px_4px_8px_rgba(163,177,198,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]">

<!-- button toggling between the two -->
<button class="rounded-xl bg-[#E0E5EC] px-6 py-3 font-medium text-slate-700
               shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.9)]
               transition-shadow duration-200
               active:shadow-[inset_3px_3px_6px_rgba(163,177,198,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]">
```

The element background must match the parent background exactly. Any contrast between them breaks the illusion.

## Gradients

```html
<!-- linear, token stops -->
<div class="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">

<!-- exact stops and angle -->
<div class="bg-[linear-gradient(135deg,#6366F1_0%,#8B5CF6_50%,#EC4899_100%)]">

<!-- fade to transparent (overlay on an image) -->
<div class="bg-gradient-to-t from-black/80 via-black/20 to-transparent">

<!-- subtle surface sheen -->
<div class="bg-gradient-to-b from-white/10 to-transparent">

<!-- radial glow behind a hero -->
<div class="bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.30),transparent_70%)]">

<!-- conic -->
<div class="bg-[conic-gradient(from_180deg_at_50%_50%,#6366F1,#EC4899,#6366F1)]">
```

Direction utilities: `bg-gradient-to-t/-tr/-r/-br/-b/-bl/-l/-tl`.

## Gradient text

```html
<h1 class="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
  Build faster
</h1>
```

`text-transparent` is required. On Safari also emit `[-webkit-background-clip:text]` if the gradient is critical. Gradient text loses contrast — keep it for display sizes only, and give screen readers the plain string (which they get automatically since the text is real).

## Gradient borders

Border-color can't take a gradient, so use a padded wrapper:

```html
<div class="rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-px">
  <div class="rounded-2xl bg-slate-950 p-6">content</div>
</div>
```

Or a masked pseudo-element for a border that sits on top of content:

```html
<div class="relative rounded-2xl before:absolute before:inset-0 before:rounded-2xl before:p-px
            before:bg-gradient-to-r before:from-white/20 before:to-transparent
            before:[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]
            before:[mask-composite:exclude]">
```

The wrapper approach is more robust; use the mask when the border must overlay scrolling content.

## Glow

```html
<!-- accent button glow -->
<button class="shadow-lg shadow-indigo-500/40">

<!-- ambient glow behind an element -->
<div class="relative">
  <div class="absolute -inset-8 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden="true"></div>
  <div class="relative">content</div>
</div>

<!-- text glow -->
<span class="[text-shadow:0_0_20px_rgba(99,102,241,0.6)]">
```

Glow is a blurred copy behind the element, not a shadow with offset — keep offsets at 0 and lean on blur radius.

## Layered shadows

Real depth uses two or three layers: a tight one for the contact edge, a wide one for ambient light.

```
/* subtle card */
shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-2px_rgba(16,24,40,0.06)]

/* standard card */
shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-4px_rgba(16,24,40,0.10)]

/* modal / popover */
shadow-[0_4px_8px_rgba(16,24,40,0.08),0_24px_48px_-12px_rgba(16,24,40,0.18)]

/* hover lift — bigger blur, more negative spread */
hover:shadow-[0_2px_4px_rgba(16,24,40,0.06),0_16px_40px_-8px_rgba(16,24,40,0.16)]
```

Tint the shadow toward the background hue (here a blue-gray `16,24,40`) rather than pure black — pure black shadows look muddy on colored backgrounds.

## Mesh and blob backgrounds

```html
<div class="relative overflow-hidden bg-slate-950">
  <div aria-hidden="true"
       class="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-[100px]"></div>
  <div aria-hidden="true"
       class="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-[120px]"></div>
  <div class="relative">content</div>
</div>
```

`overflow-hidden` on the parent and `pointer-events-none` on the blobs are both load-bearing.

## Grid and dot patterns

```html
<!-- grid lines -->
<div class="absolute inset-0
            bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]
            bg-[size:40px_40px]"></div>

<!-- dots -->
<div class="absolute inset-0
            bg-[radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)]
            bg-[size:20px_20px]"></div>
```

Almost always paired with a fade mask (below) so the pattern doesn't run to the edges.

## Masks and fades

```html
<!-- fade a pattern out toward the bottom -->
<div class="[mask-image:linear-gradient(to_bottom,black,transparent)]">

<!-- vignette -->
<div class="[mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]">

<!-- fade the edges of a horizontal marquee -->
<div class="[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
```

## Animations

Tailwind ships `animate-spin`, `animate-ping`, `animate-pulse`, `animate-bounce`. Anything else needs keyframes. Since a single-file component can't touch `tailwind.config.js`, declare them inline:

```tsx
<style>{`
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-12px); }
  }
  @keyframes shimmer {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
`}</style>
```

Then apply:

```html
<div class="animate-[fadeUp_0.6s_ease-out_both]">
<div class="animate-[fadeUp_0.6s_ease-out_0.15s_both]">   <!-- staggered -->
<div class="animate-[float_6s_ease-in-out_infinite]">
<div class="bg-[length:200%_100%] animate-[gradientShift_8s_ease_infinite]">
<div class="flex w-max animate-[marquee_30s_linear_infinite]">  <!-- duplicate children -->
```

`both` as fill-mode keeps the element in its start state before the delay fires — without it, staggered entrances flash at full opacity first.

Skeleton shimmer:

```html
<div class="h-4 w-40 rounded bg-slate-200
            bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]
            bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"></div>
```

Scroll-triggered reveals need `IntersectionObserver`. Keep it to a small hook rather than a library:

```tsx
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && (setInView(true), io.disconnect()),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}
```

## Hover treatments

```html
<!-- card lift -->
<article class="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

<!-- image zoom inside a fixed frame -->
<div class="overflow-hidden rounded-xl">
  <img class="transition-transform duration-500 group-hover:scale-105" />
</div>

<!-- underline sweep -->
<a class="relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0
          after:bg-current after:transition-all after:duration-300 hover:after:w-full">

<!-- sheen sweep across a button -->
<button class="group relative overflow-hidden">
  <span class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent
               transition-transform duration-700 group-hover:translate-x-full"></span>
  <span class="relative">Get started</span>
</button>

<!-- border/background brighten -->
<div class="border border-white/10 transition-colors hover:border-white/20 hover:bg-white/5">
```

`group` on the parent plus `group-hover:` on children is the mechanism for anything where hovering the card changes an inner element.

## Reduced motion

Anything continuous or large should respect the user's setting:

```html
<div class="motion-safe:animate-[float_6s_ease-in-out_infinite]">
```

Or in the inline style block:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Short hover transitions are fine to leave alone; infinite float/pulse/marquee animations are the ones that cause problems.
