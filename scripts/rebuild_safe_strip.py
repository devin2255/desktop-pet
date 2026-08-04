#!/usr/bin/env python3
"""Rebuild chroma strips with enforced gutters from an existing AI strip or pose images."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chroma_key import chroma_key  # noqa: E402

ALPHA = 24
MIN_H_RATIO = 0.12
MIN_V_RATIO = 0.06


def subject_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = img.getchannel("A").point(lambda v: 255 if v > ALPHA else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("empty subject")
    return box


def place_in_cell(subject: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    box = subject_bbox(subject)
    cropped = subject.crop(box)
    gutter_x = max(8, int(cell_w * MIN_H_RATIO))
    gutter_y = max(8, int(cell_h * MIN_V_RATIO))
    max_w = cell_w - 2 * gutter_x
    max_h = cell_h - 2 * gutter_y
    scale = min(max_w / cropped.width, max_h / cropped.height)
    size = (max(1, int(cropped.width * scale)), max(1, int(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (cell_w, cell_h), (0, 255, 0, 255))
    # Composite subject onto green, then keep green as opaque chroma for strip file
    x = (cell_w - resized.width) // 2
    y = cell_h - gutter_y - resized.height  # foot baseline
    # Paint subject over green
    cell.paste(resized, (x, y), resized)
    # Restore pure green where alpha is low
    arr = np.asarray(cell).copy()
    alpha = arr[..., 3]
    subject_mask = alpha > ALPHA
    # Where not subject, force chroma green opaque
    arr[~subject_mask, 0] = 0
    arr[~subject_mask, 1] = 255
    arr[~subject_mask, 2] = 0
    arr[~subject_mask, 3] = 255
    # Where subject, keep RGB and force opaque for strip processing after later key
    arr[subject_mask, 3] = 255
    return Image.fromarray(arr, "RGBA")


def split_strip(img: Image.Image, count: int) -> list[Image.Image]:
    edges = [round(i * img.width / count) for i in range(count + 1)]
    return [img.crop((edges[i], 0, edges[i + 1], img.height)) for i in range(count)]


def rebuild_from_strip(src: Path, count: int, out: Path, cell_h: int = 1024) -> None:
    keyed = chroma_key(Image.open(src))
    cells = split_strip(keyed, count)
    cell_w = max(320, keyed.width // count)
    rebuilt = []
    for cell in cells:
        rebuilt.append(place_in_cell(cell, cell_w, cell_h))
    strip = Image.new("RGBA", (cell_w * count, cell_h), (0, 255, 0, 255))
    for i, cell in enumerate(rebuilt):
        strip.paste(cell, (i * cell_w, 0))
    # Convert to RGB green-screen PNG (no alpha) for consistency with AI strips
    rgb = Image.new("RGB", strip.size, (0, 255, 0))
    rgb.paste(strip, mask=strip.getchannel("A"))
    out.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(out, optimize=True)
    print(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cell-height", type=int, default=1024)
    args = parser.parse_args()
    rebuild_from_strip(args.input, args.count, args.output, args.cell_height)


if __name__ == "__main__":
    main()
