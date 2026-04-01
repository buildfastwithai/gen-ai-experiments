# Repository Organization Plan

## Target Top-Level Structure

```text
.
├─ 100-os-libraries/
├─ cookbooks/
├─ apps/
├─ agents/
├─ rag/
├─ fine-tuning/
├─ workshops/
├─ roadmaps/
├─ experiments/
├─ docs/
└─ assets/
```

## Applied Top-Level Mapping

- `100-os-libraries` -> `100-os-libraries/`
- `ai-apps-collection` -> `apps/`
- `ai-agents` -> `agents/`
- `rag` -> `rag/`
- `llm-testing` -> `cookbooks/`
- `fine-tuning` -> `fine-tuning/`
- `workshop` -> `workshops/`
- `roadmap` -> `roadmaps/`
- `experiment` -> `experiments/`
- `.resources` -> `assets/`

## Naming Conventions

- Use lowercase kebab-case for folder names.
- Avoid spaces, emojis, and temporary suffixes like `(1)`.
- Standardize on `README.md` naming.
- Use descriptive notebook names in the form:
  - `<topic>-<tool-or-model>-<purpose>.ipynb`

## Migration Notes

- Shared links to old paths can break after renames.
- Renames should be bundled with README link updates.
- Keep branded names stable when they carry recognition value.

## Next Steps

1. Normalize remaining project and notebook names over time.
2. Move mature work from `experiments/` into stable categories.
3. Keep the content catalog up to date via `docs/content-catalog.md` and `docs/content-index.csv`.
