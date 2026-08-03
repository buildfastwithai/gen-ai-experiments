# QUICKSTART.md spec

The quickstart is read by someone who is mildly annoyed and wants to be done. Optimize
for time-to-running, not completeness. Everything that isn't on the critical path belongs
in the README or `docs/`.

Target length: under 120 lines. If it's longer, the repo needs a `make setup`, not more prose.

## Sections, in order

### 1. Title and one-line promise
State the time budget and what the reader ends up with.

> Get the API running locally in about 5 minutes.

### 2. What success looks like
Before any instructions. A code block showing the output or URL that means "done".
This lets the reader recognize completion and skip steps they've already done.

### 3. Prerequisites
A table: tool, minimum version, how to check. Only tools actually required — not
"nice to have". Link to the doctor script as the fast path:

```bash
./scripts/doctor.sh
```

### 4. Setup
Numbered steps, one fenced block each. Rules:

- No `$` or `>` prompt characters — they break copy-paste.
- One block = one paste. Don't split a two-line sequence into two blocks.
- Show both shells when they differ. Label the fences `bash` and `powershell`.
- Put the *expected* output under any step whose success is ambiguous.
- Comment non-obvious flags inline rather than in a paragraph after.

### 5. Run
The single command that starts the thing, plus the verify command from section 2 so the
reader can confirm without scrolling up.

### 6. Common tasks
A short table only: run tests, run migrations, lint, build, reset local state. Three to
six rows. This is the section people return to after onboarding.

### 7. Troubleshooting
Keyed by the **literal error text** the reader sees, because that is what they search for.

```markdown
**`EADDRINUSE: address already in use :::3000`**
Another process holds the port. Find and stop it:
...
```

Not "Port conflicts" — nobody searches for that. Include the failures you actually hit
while verifying; those are the real ones. Three to five entries is plenty.

### 8. Next steps
Two or three links: architecture doc, contributing guide, the issue tracker.

## Voice

Imperative and specific. "Run `pnpm install`" beats "you can now install dependencies".
No "simply", "just", or "easy" — if it were easy the file wouldn't exist.

Say why only when the why changes behavior: "Use pnpm — npm will produce a broken tree
because the workspace uses pnpm-only link syntax."

## Verification checklist

Before you hand it over:

- [ ] Every command traces to a real script, target, or file in the repo
- [ ] Versions match the manifests and CI, not your memory
- [ ] The verify step is something the reader can actually observe
- [ ] Windows and Unix paths both work, or both are shown
- [ ] Anything you could not run is marked `> **Unverified:**`
- [ ] Linked from the main README
