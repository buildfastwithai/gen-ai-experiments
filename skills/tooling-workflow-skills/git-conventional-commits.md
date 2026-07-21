---
name: git-conventional-commits
description: Analyze repository diffs and generate high-quality Conventional Commit messages and pull request descriptions. Use this whenever users request commit drafting, changelog-friendly summaries, or PR writeups from current changes.
---

# Git Conventional Commits

Generate high-quality Conventional Commits and PR descriptions from real diffs.

## Use When
- A user asks for commit message generation.
- A user needs a complete PR draft from current changes.
- A project uses changelog or release automation.

## Inputs To Collect
- Current diff and changed files.
- Team conventions and scope naming style.
- Whether changes should be split into multiple commits.
- Test evidence available.

## Workflow
1. Analyze change intent per file group.
2. Map each group to the correct commit type/scope.
3. Draft concise subject lines and meaningful bodies.
4. Flag breaking changes and migration notes.
5. Draft PR title, summary, risks, and validation checklist.

## Output Template
Use this exact template:

# Commit Suggestions
1. type(scope): subject
- Why:
- Key changes:

# Recommended Commit Plan
- [Single commit or multi-commit plan]

# PR Draft
## Title
## Summary
## Testing
## Risks
## Checklist

## Quality Bar
- Keep subject lines concise and imperative.
- Do not mix unrelated changes in one suggestion.
- Tie every claim to observed diff changes.


## Advanced Guidelines & Deep Dive
### Deep Commit Analysis
- **Scoping Precision**: Do not just use `feat(core)`. Analyze the directory structure to identify the exact module (e.g., `fix(api/auth)` or `feat(components/button)`).
- **The "Why", Not the "What"**: Generating "Changed x to y in file z" is useless. The commit body MUST explain *why* the change was made (e.g., "Resolves race condition during fast token rotation by locking the DB row").
- **Breaking Changes**: Explicitly scan for deleted endpoints, changed function signatures, or DB schema drops. If found, require the `BREAKING CHANGE:` footer.

### Pull Request Storytelling
- **Contextual Linking**: Automatically format PR descriptions to include "Closes #Issue" or "Related to Ticket-123" sections.
- **Testing Instructions**: Include a generated minimum step-by-step test plan in the PR, derived from the diff (e.g., "Log in, click X, ensure Y does not crash").

### Anti-Patterns to Avoid
- **The Omnibus Commit**: Combining a UI refactor, a dependency update, and a typo fix into a single `feat:` commit. Force splitting suggestions.
- **Vague Subjects**: `fix: bug` or `chore: updates`. Refuse these and enforce `fix(db): resolve connection pool exhaustion`.
