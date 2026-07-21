#!/usr/bin/env python3
"""Copy the Talking Avatar core into an existing Next/vinext project."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, type=Path, help="Existing project directory")
    parser.add_argument("--character-name", required=True)
    parser.add_argument("--app-name", required=True)
    parser.add_argument("--persona", required=True)
    parser.add_argument("--model", required=True, help="Realtime model verified for this run")
    parser.add_argument("--transcription-model", required=True, help="Input transcription model verified for this run")
    parser.add_argument("--voice", required=True, help="Realtime voice verified for this run")
    parser.add_argument("--force", action="store_true", help="Overwrite generated destination files")
    parser.add_argument("--dry-run", action="store_true", help="List changes without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    skill_dir = Path(__file__).resolve().parent.parent
    template_dir = skill_dir / "assets" / "starter"
    target = args.target.expanduser().resolve()

    if not template_dir.is_dir():
        raise SystemExit(f"Starter templates not found: {template_dir}")
    if not target.is_dir():
        raise SystemExit(f"Target project does not exist: {target}")
    if not (target / "package.json").exists():
        raise SystemExit("Target must be an initialized JavaScript project with package.json")

    replacements = {
        "__CHARACTER_NAME__": args.character_name,
        "__CHARACTER_NAME_UPPER__": args.character_name.upper(),
        "__APP_NAME__": args.app_name,
        "__CHARACTER_PERSONA__": args.persona,
        "__REALTIME_MODEL__": args.model,
        "__TRANSCRIPTION_MODEL__": args.transcription_model,
        "__REALTIME_VOICE__": args.voice,
    }

    jobs: list[tuple[Path, Path, str]] = []
    for source in sorted(template_dir.rglob("*.tmpl")):
        relative = source.relative_to(template_dir)
        destination = target / relative.with_suffix("")
        content = source.read_text(encoding="utf-8")
        for token, value in replacements.items():
            content = content.replace(token, value)
        unresolved = sorted(set(re.findall(r"__[A-Z0-9_]+__", content)))
        if unresolved:
            raise SystemExit(f"Unresolved placeholders in {relative}: {', '.join(unresolved)}")
        if destination.exists() and not args.force:
            raise SystemExit(f"Refusing to overwrite {destination}; inspect it and rerun with --force only for a fresh project")
        jobs.append((source, destination, content))

    for _, destination, content in jobs:
        print(f"{'WOULD WRITE' if args.dry_run else 'WRITE'} {destination}")
        if not args.dry_run:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8")

    print("Required packages: framer-motion, @phosphor-icons/react")
    print("Next: add the four generated files under public/avatar and run validate_avatar_assets.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
