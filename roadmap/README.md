# GenAI Learning Curriculum (Beginner to Advanced)

This repository is a structured, project-based curriculum for learning Generative AI.

It keeps all existing projects and notebooks, but organizes how to learn from them in a clear order.

## What This Repo Is

This is a hands-on roadmap for students, developers, and builders who want to learn GenAI by building real projects.

- You start from prerequisites.
- You move through LLM basics, app development, RAG, and agents.
- You reach production systems and advanced specialization tracks.

## Learning Roadmap

Start here:

- [Full Roadmap](docs/roadmap/roadmap.md)

Level files:

- [Level 0 - Prerequisites](docs/roadmap/level-0.md)
- [Level 1 - LLM Basics](docs/roadmap/level-1.md)
- [Level 2 - Simple GenAI Apps](docs/roadmap/level-2.md)
- [Level 3 - RAG + Agents](docs/roadmap/level-3.md)
- [Level 4 - Production Systems](docs/roadmap/level-4.md)
- [Level 5 - Advanced GenAI](docs/roadmap/level-5.md)
- [Level 6 - Specialization Paths](docs/roadmap/level-6.md)

## Interactive Website

An interactive roadmap-style website is available in:

- [genai-roadmap-site](genai-roadmap-site)

Run it locally:

1. `cd genai-roadmap-site`
2. `npm install`
3. `npm run dev`

## Level Overview

- Level 0: Environment setup, Python basics, APIs, notebooks
- Level 1: Prompts, model basics, core GenAI libraries
- Level 2: Build simple apps with chat, generation, and workflows
- Level 3: Build RAG pipelines and single/multi-agent systems
- Level 4: Evaluate, test, monitor, and harden GenAI systems
- Level 5: Work on advanced multimodal, MCP, optimization, and research-heavy builds
- Level 6: Follow role-based paths and build a capstone portfolio

## Quick Start

1. Clone your fork
   ```bash
   git clone https://github.com/AnshumanSakhare/gen-ai-experiments.git
   cd gen-ai-experiments
   ```
2. Open the roadmap and begin at Level 0
   - docs/roadmap/roadmap.md
3. Choose one project from your current level
4. Create a local `.env` file for API keys needed by that project
5. Install dependencies inside the selected project folder
   ```bash
   pip install -r requirements.txt
   ```
6. Run the project according to its local instructions

## Project Categories

Projects are grouped in existing folders and used by the roadmap:

- `100-os-libraries`: library-first learning notebooks
- `workshop`: guided workshop notebooks
- `ai-apps-collection`: app-focused GenAI builds
- `ai-agents`: agent patterns and agent frameworks
- `rag`: retrieval-augmented generation projects
- `llm-testing`: evaluation and benchmark work
- `fine-tuning`: model adaptation and training workflows
- `experiment`: experimental and advanced explorations

## Contribution Guide

Contributions are welcome.

1. Fork the repository
2. Create a branch (`feature/your-topic`)
3. Add or improve a project, docs, or checkpoint
4. Keep project setup instructions clear and runnable
5. Open a pull request with a short summary of learning value

Recommended contribution types:

- Add a beginner-friendly project for Levels 1-2
- Add RAG or agent projects for Levels 3-4
- Add production checklists, eval recipes, or guardrail examples for Levels 4-5
- Add specialization path material and capstone ideas for Level 6

## Notes

- Existing projects are not moved or deleted.
- The roadmap tells learners what to open and when.
- Use this fork for your curriculum updates and experiments.
