# GenAI Roadmap Website

This is a React website inspired by roadmap-style learning UIs, built specifically for this repository.

It guides beginners from prerequisites to advanced GenAI levels and links every level to real projects in this repo.

## What It Includes

- Level-by-level learning flow from Level 0 to Level 6
- Checkpoint tasks for each level
- Unlock next level only after completing checkpoints
- Direct links to project folders and notebooks in this repository
- Saved progress in browser local storage

## Run Locally

1. Open this folder
2. Install dependencies

```bash
npm install
```

3. Start dev server

```bash
npm run dev
```

4. Build production bundle

```bash
npm run build
```

## Notes

- Repository links inside the UI point to your fork by default.
- You can update the repo URL in src/App.jsx by changing repoBase.
