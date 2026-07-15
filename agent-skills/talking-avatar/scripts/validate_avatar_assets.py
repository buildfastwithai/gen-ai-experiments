#!/usr/bin/env python3
"""Validate the required talking-avatar image assets without third-party packages."""

from __future__ import annotations

import argparse
from pathlib import Path
import struct
import sys


REQUIRED = (
    "avatar-base.jpg",
    "mouth-soft.png",
    "mouth-round.png",
    "mouth-open.png",
)


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", data[16:24])


def jpeg_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        if handle.read(2) != b"\xff\xd8":
            raise ValueError("not a JPEG")
        while True:
            prefix = handle.read(1)
            if not prefix:
                break
            if prefix != b"\xff":
                continue
            marker = handle.read(1)
            while marker == b"\xff":
                marker = handle.read(1)
            if marker in {bytes([value]) for value in range(0xC0, 0xC4)} | {bytes([value]) for value in range(0xC5, 0xC8)} | {bytes([value]) for value in range(0xC9, 0xCC)} | {bytes([value]) for value in range(0xCD, 0xD0)}:
                length = struct.unpack(">H", handle.read(2))[0]
                payload = handle.read(length - 2)
                height, width = struct.unpack(">HH", payload[1:5])
                return width, height
            if marker in (b"\xd8", b"\xd9"):
                continue
            length_bytes = handle.read(2)
            if len(length_bytes) != 2:
                break
            length = struct.unpack(">H", length_bytes)[0]
            handle.seek(length - 2, 1)
    raise ValueError("JPEG dimensions not found")


def image_size(path: Path) -> tuple[int, int]:
    return png_size(path) if path.suffix.lower() == ".png" else jpeg_size(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, type=Path, help="Directory containing avatar assets")
    args = parser.parse_args()
    root = args.dir.expanduser().resolve()
    errors: list[str] = []
    sizes: dict[str, tuple[int, int]] = {}

    for name in REQUIRED:
        path = root / name
        if not path.is_file():
            errors.append(f"missing {name}")
            continue
        if path.stat().st_size == 0:
            errors.append(f"empty {name}")
            continue
        try:
            sizes[name] = image_size(path)
        except (OSError, ValueError, struct.error) as error:
            errors.append(f"invalid {name}: {error}")

    base = sizes.get("avatar-base.jpg")
    mouth_sizes = [sizes.get(name) for name in REQUIRED[1:]]
    if base:
        width, height = base
        ratio = width / height
        if not 0.55 <= ratio <= 0.8:
            errors.append(f"avatar-base.jpg should be portrait-oriented; got {width}x{height}")
    if all(mouth_sizes):
        unique = set(mouth_sizes)
        if len(unique) != 1:
            errors.append(f"mouth patches must have identical dimensions; got {sorted(unique)}")
        elif base:
            patch_width, patch_height = mouth_sizes[0]  # type: ignore[misc]
            if patch_width >= base[0] * 0.35 or patch_height >= base[1] * 0.35:
                errors.append("mouth patches are too large relative to the canonical portrait")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    for name in REQUIRED:
        width, height = sizes[name]
        print(f"OK {name}: {width}x{height}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
