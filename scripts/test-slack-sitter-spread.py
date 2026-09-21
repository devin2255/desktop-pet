#!/usr/bin/env python3
"""Sitters in slack-carry/jump must hold the left and right of the phone, not the middle."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "pets" / "library" / "brother-duo" / "animations"
ALPHA_CUTOFF = 12


def opaque_stats(image: Image.Image, x0: int, x1: int) -> tuple[float, int, int, int]:
    pixels = image.load()
    width, height = image.size
    sx = sy = count = 0
    min_x, max_x = width, -1
    for y in range(height):
        for x in range(x0, x1):
            if pixels[x, y][3] > ALPHA_CUTOFF:
                sx += x
                sy += y
                count += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
    if count == 0:
        raise AssertionError(f"no opaque pixels in x=[{x0}, {x1})")
    return sx / count, min_x, max_x, count


def assert_spread(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    width, _height = image.size
    mid = width // 2
    left_cx, _left_min, left_max, _left_n = opaque_stats(image, 0, mid)
    right_cx, right_min, _right_max, _right_n = opaque_stats(image, mid, width)
    gap = right_min - left_max
    assert left_cx / width <= 0.34, f"{path.name} left centroid {left_cx / width:.3f} should sit under the left pane"
    assert right_cx / width >= 0.66, f"{path.name} right centroid {right_cx / width:.3f} should sit under the right pane"
    assert gap >= int(width * 0.12), f"{path.name} inner gap {gap}px is too tight for left/right lifting"


def main() -> None:
    frames = [
        LIBRARY / "slack-carry" / "01.png",
        LIBRARY / "slack-carry" / "02.png",
        LIBRARY / "slack-carry" / "03.png",
        LIBRARY / "slack-carry" / "04.png",
        LIBRARY / "slack-jump" / "04.png",
    ]
    for frame in frames:
        assert frame.is_file(), f"missing {frame}"
        assert_spread(frame)
    print("test-slack-sitter-spread: ok")


if __name__ == "__main__":
    main()
