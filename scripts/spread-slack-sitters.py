#!/usr/bin/env python3
"""Bake half-size sitters onto the left and right of slack frames (CSS scale stays 1)."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "pets" / "library" / "brother-duo" / "animations"
SOURCE = ROOT / "tmp" / "slack-sitter-source"
ALPHA_CUTOFF = 12
CANVAS = 480
MARGIN = 10
SCALE = 0.5
LEFT_CENTER = 0.28
RIGHT_CENTER = 0.72
ACTIONS = ("slack-carry", "slack-jump")


def opaque_bbox(image: Image.Image, x0: int, x1: int) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    min_x, min_y, max_x, max_y = width, height, -1, -1
    for y in range(height):
        for x in range(x0, x1):
            if pixels[x, y][3] > ALPHA_CUTOFF:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < 0:
        raise ValueError("no opaque pixels in slice")
    return min_x, min_y, max_x + 1, max_y + 1


def place_subject(canvas: Image.Image, subject: Image.Image, center_x: float, foot_y: int) -> None:
    new_w = max(1, round(subject.width * SCALE))
    new_h = max(1, round(subject.height * SCALE))
    resized = subject.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = int(round(center_x - new_w / 2))
    y = int(foot_y - new_h)
    x = max(MARGIN, min(canvas.width - new_w - MARGIN, x))
    y = max(MARGIN, min(canvas.height - new_h - MARGIN, y))
    canvas.alpha_composite(resized, (x, y))


def spread_frame(source: Path, dest: Path) -> int:
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    mid = width // 2
    left_box = opaque_bbox(image, 0, mid)
    right_box = opaque_bbox(image, mid, width)
    foot_y = max(left_box[3], right_box[3])
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    place_subject(canvas, image.crop(left_box), width * LEFT_CENTER, foot_y)
    place_subject(canvas, image.crop(right_box), width * RIGHT_CENTER, foot_y)
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest)
    pixels = canvas.load()
    min_y = height
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > ALPHA_CUTOFF:
                min_y = y
                break
        if min_y < height:
            break
    return min_y


def ensure_sources() -> None:
    for action in ACTIONS:
        dest_dir = SOURCE / action
        dest_dir.mkdir(parents=True, exist_ok=True)
        for frame in sorted((LIBRARY / action).glob("*.png")):
            backup = dest_dir / frame.name
            if not backup.exists():
                shutil.copy2(frame, backup)


def main() -> None:
    ensure_sources()
    palm_ys: list[int] = []
    for action in ACTIONS:
        for frame in sorted((SOURCE / action).glob("*.png")):
            dest = LIBRARY / action / frame.name
            palm_ys.append(spread_frame(frame, dest))
            print(f"wrote {dest.relative_to(ROOT)} palm_y={palm_ys[-1]}")
    carry_ys = palm_ys[:4]
    avg = sum(carry_ys) / len(carry_ys)
    ratio = (CANVAS - avg) / CANVAS
    print(f"carry palm-from-bottom ratio={ratio:.3f}")


if __name__ == "__main__":
    main()
