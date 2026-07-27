# Component Patterns

Structural skeletons for the archetypes that show up in most screenshots, with the accessibility wiring already in place. These are starting points — replace the values with what you measured.

Contents:
1. [File and component conventions](#file-and-component-conventions)
2. [Navbar](#navbar)
3. [Hero](#hero)
4. [Button](#button)
5. [Feature card grid](#feature-card-grid)
6. [Pricing cards](#pricing-cards)
7. [Testimonial](#testimonial)
8. [Badge](#badge)
9. [Avatar group](#avatar-group)
10. [Stat block](#stat-block)
11. [Progress bar](#progress-bar)
12. [Tabs](#tabs)
13. [Accordion](#accordion)
14. [Modal](#modal)
15. [Form field](#form-field)
16. [Footer](#footer)
17. [Accessibility checklist](#accessibility-checklist)

---

## File and component conventions

```tsx
import { ArrowRight, Check } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return ( /* ... */ );
}
```

- Named exports for subcomponents, default export for the top-level component.
- Content lives in typed arrays above the component, not inline in JSX.
- Pass icons as components (`icon: LucideIcon`), not strings.
- `cn` helper only if there's real conditional logic; otherwise template literals are fine.

```tsx
const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');
```

## Navbar

```tsx
<header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
  <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />
      Acme
    </a>

    <ul className="hidden items-center gap-8 md:flex">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href}
             className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            {link.label}
          </a>
        </li>
      ))}
    </ul>

    <div className="hidden items-center gap-3 md:flex">
      <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</a>
      <a href="/signup" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800">
        Get started
      </a>
    </div>

    <button type="button" onClick={() => setOpen((o) => !o)}
            aria-expanded={open} aria-controls="mobile-menu" aria-label="Toggle menu"
            className="md:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100">
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  </nav>

  {open && (
    <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
      {/* stacked links */}
    </div>
  )}
</header>
```

Active link state: `aria-current="page"` plus the visual treatment from the screenshot.

## Hero

```tsx
<section className="relative overflow-hidden bg-slate-950 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
  <div aria-hidden="true"
       className="pointer-events-none absolute inset-x-0 top-0 h-[32rem]
                  bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.25),transparent_70%)]" />

  <div className="relative mx-auto max-w-3xl text-center">
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1
                     text-xs font-medium tracking-wide text-indigo-300">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      Now in public beta
    </span>

    <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.1]">
      Ship your interface in minutes
    </h1>

    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
      Supporting copy that explains the product in one or two sentences.
    </p>

    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
      {/* primary + secondary button */}
    </div>
  </div>
</section>
```

Note the ordering: `mt-6` after the badge, `mt-6` after the h1, `mt-10` before the buttons. Vertical rhythm in heroes is almost always driven by margin-top on successive elements rather than a uniform gap.

## Button

```tsx
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium ' +
  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-600 shadow-sm shadow-indigo-600/25',
  secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
} as const;

const sizes = {
  sm: 'h-9 px-3',
  md: 'h-10 px-4',
  lg: 'h-12 px-6 text-base',
} as const;
```

Use `<a>` when it navigates, `<button type="button">` when it acts. Icon-only variants need `aria-label`.

## Feature card grid

```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {features.map((feature) => (
    <article key={feature.title}
             className="group rounded-2xl border border-slate-200 bg-white p-6
                        transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <feature.icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
    </article>
  ))}
</div>
```

## Pricing cards

```tsx
<article className={cn(
  'relative flex flex-col rounded-2xl border p-8',
  tier.featured
    ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-600/10 lg:scale-105'
    : 'border-slate-200 bg-white'
)}>
  {tier.featured && (
    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1
                     text-xs font-semibold text-white">
      Most popular
    </span>
  )}

  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tier.name}</h3>

  <p className="mt-4 flex items-baseline gap-1">
    <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">${tier.price}</span>
    <span className="text-sm text-slate-500">/month</span>
  </p>

  <ul role="list" className="mt-8 flex-1 space-y-3">
    {tier.features.map((f) => (
      <li key={f} className="flex gap-3 text-sm text-slate-600">
        <Check className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
        {f}
      </li>
    ))}
  </ul>

  <button className="mt-8 ...">{tier.cta}</button>
</article>
```

`flex flex-col` + `flex-1` on the list is what keeps the CTAs aligned across cards of unequal content length. `items-baseline` on the price row is what makes `$49` and `/month` sit correctly.

## Testimonial

```tsx
<figure className="rounded-2xl border border-slate-200 bg-white p-8">
  <blockquote className="text-lg leading-relaxed text-slate-700">
    "{quote}"
  </blockquote>
  <figcaption className="mt-6 flex items-center gap-4">
    <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
    <div>
      <div className="text-sm font-semibold text-slate-900">{name}</div>
      <div className="text-sm text-slate-500">{role}</div>
    </div>
  </figcaption>
</figure>
```

`alt=""` on the avatar because the name is right next to it — a redundant alt is noise for screen reader users.

## Badge

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5
                 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
  Active
</span>
```

Small *and* semibold. Status colors: emerald (success), amber (warning), rose (error), sky (info), slate (neutral).

## Avatar group

```tsx
<div className="flex -space-x-2">
  {users.slice(0, 4).map((u) => (
    <img key={u.id} src={u.avatar} alt={u.name}
         className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
  ))}
  {users.length > 4 && (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100
                     text-xs font-medium text-slate-600 ring-2 ring-white">
      +{users.length - 4}
    </span>
  )}
</div>
```

The `ring` must match the surface color behind the stack — that's what creates the cut-out edge.

## Stat block

```tsx
<div>
  <dt className="text-sm font-medium text-slate-500">Active users</dt>
  <dd className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">12,483</dd>
  <dd className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
    <TrendingUp className="h-4 w-4" aria-hidden="true" />
    +12.5%
  </dd>
</div>
```

Wrap groups in `<dl>`. `tabular-nums` keeps figures from jittering when they update.

## Progress bar

```tsx
<div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
     aria-label="Upload progress"
     className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
  <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-out"
       style={{ width: `${value}%` }} />
</div>
```

Width is the one thing that belongs in an inline style — it's data, not design.

## Tabs

```tsx
<div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-slate-200">
  {tabs.map((tab) => (
    <button key={tab.id} role="tab" id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              active === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            )}>
      {tab.label}
    </button>
  ))}
</div>

<div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
  {/* panel content */}
</div>
```

`-mb-px` is what makes the active underline sit on top of the container border instead of below it. Arrow-key navigation between tabs is the expected behavior — add a `keydown` handler when the design is tab-heavy.

## Accordion

```tsx
<div className="divide-y divide-slate-200 border-y border-slate-200">
  {items.map((item, i) => {
    const isOpen = open === i;
    return (
      <div key={item.q}>
        <h3>
          <button type="button" onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen} aria-controls={`acc-panel-${i}`}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left
                             text-base font-medium text-slate-900">
            {item.q}
            <ChevronDown className={cn('h-5 w-5 flex-none text-slate-400 transition-transform duration-200',
                                       isOpen && 'rotate-180')} aria-hidden="true" />
          </button>
        </h3>
        <div id={`acc-panel-${i}`} hidden={!isOpen} className="pb-5 text-sm leading-relaxed text-slate-600">
          {item.a}
        </div>
      </div>
    );
  })}
</div>
```

For a smooth height animation use `grid-rows-[0fr]` → `grid-rows-[1fr]` on a wrapper with `overflow-hidden`; `height: auto` can't be transitioned.

## Modal

```tsx
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
         onClick={onClose} aria-hidden="true" />
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
         className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl
                    animate-[fadeUp_0.2s_ease-out]">
      <h2 id="modal-title" className="text-lg font-semibold text-slate-900">Title</h2>
      <button type="button" onClick={onClose} aria-label="Close dialog"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  </div>
)}
```

Also handle Escape to close, focus the dialog on open, and restore focus to the trigger on close.

## Form field

```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
    Email
  </label>
  <input id="email" type="email" placeholder="you@company.com"
         aria-describedby={error ? 'email-error' : undefined}
         aria-invalid={!!error}
         className={cn(
           'mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm text-slate-900',
           'placeholder:text-slate-400 transition-colors',
           'focus:outline-none focus:ring-2 focus:ring-offset-0',
           error
             ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
             : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
         )} />
  {error && <p id="email-error" className="mt-1.5 text-sm text-rose-600">{error}</p>}
</div>
```

Every input needs a `<label>` with a matching `htmlFor`. A placeholder is not a label — if the design hides the label visually, use `sr-only` rather than dropping it.

## Footer

```tsx
<footer className="border-t border-slate-200 bg-slate-50">
  <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
      {columns.map((col) => (
        <div key={col.title}>
          <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
          <ul role="list" className="mt-4 space-y-3">
            {col.links.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-sm text-slate-600 hover:text-slate-900">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-500">
      © {new Date().getFullYear()} Acme, Inc.
    </div>
  </div>
</footer>
```

## Accessibility checklist

Run through this before returning the code. Most items cost one attribute and are invisible in a screenshot, which is exactly why they get dropped.

- Landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`.
- One `<h1>` per page; heading levels descend without skipping.
- Clickable elements are `<button>` or `<a>` — never `<div onClick>`.
- `aria-label` on every icon-only control; `aria-hidden="true"` on decorative icons.
- `focus-visible:` ring on everything focusable.
- Images: descriptive `alt`, or `alt=""` when decorative or when adjacent text already conveys it.
- Form inputs have associated labels; errors are linked with `aria-describedby` and `aria-invalid`.
- Interactive state is exposed: `aria-expanded`, `aria-selected`, `aria-current`, `aria-checked`.
- Body text meets 4.5:1 contrast; large text 3:1. If the screenshot's muted gray is borderline, match it and mention it.
- Continuous animation respects `prefers-reduced-motion`.
- Lists are `<ul>`/`<ol>`; `role="list"` when `list-style: none` removes semantics in Safari.
