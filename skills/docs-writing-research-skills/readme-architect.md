---
name: readme-architect
description: Build production-quality GitHub README files with badges, setup instructions, usage examples, and contribution guidance. Use this whenever a repository needs documentation, onboarding, or open source readiness.
---

# README Architect

Generate complete and practical GitHub README files for onboarding, usage, and contribution.

## Use When
- A repository has weak or missing documentation.
- A user asks for setup, usage, and contribution guidance.
- A team needs a polished open-source-ready README.

## Inputs To Collect
- Project purpose and target users.
- Runtime and dependency requirements.
- Install/run/test commands.
- License and contribution preferences.

## Workflow
1. Identify audience and primary use cases.
2. Capture accurate setup and run instructions.
3. Add examples, configuration, and troubleshooting.
4. Add contribution process and governance basics.
5. Ensure skimmable headings and consistent tone.

## Output Template
Use this exact template:

# [Project Name]
[Badges]

## Overview

## Features

## Tech Stack

## Installation
### Prerequisites
### Steps

## Usage
### Quick Start
### Examples

## Project Structure

## Configuration

## Development

## Contributing

## License

## Support

## Quality Bar
- Commands must be executable as written.
- Include only relevant sections.
- Keep examples concrete and minimal.


## Advanced Guidelines & Deep Dive
### Documentation Nuance
- **Day-0 vs Day-100**: A README must solve Day-0 (how do I run this now?) immediately. Day-100 configuration belongs in `/docs`.
- **Operating System Agnosticism**: Provide install commands for macOS, Linux, and Windows (or explicitly state compatibility).
- **Security Posture**: Clearly state how to supply credentials (e.g., `.env.example`) and explicitly warn against committing secrets.

### Anti-Patterns to Avoid
- **"Just run 'make'"**: Assuming the user knows what `make` relies on. List the dependencies (Node v18, Python 3.11, Docker).
- **Missing Context**: Showing an API command without showing the expected JSON response.
- **Dead Badges**: Placeholder badges that just say "build: passing" without being linked to real CI observability.

### Repository Best Practices
- Link out to `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` if the repository exceeds basic script size.
- Include a "Troubleshooting" or "Common Issues" section for the 2 most frequent setup failures.
