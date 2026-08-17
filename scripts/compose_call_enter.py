"""Composite normalized calf-hold and mom-enter frames into call-mom-enter."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS = 480
ALPHA_CUTOFF = 24
# Mom walks in from the right; later frames stand closer. Values keep both
# subjects overlapping on the shared 480 canvas and foot baseline.
MOM_OFFSETS_X = (78, 58, 40, 26)


def harden_subject(image: Image.Image) -> Image.Image:
    """Keep soft fringe, but make the body fully opaque so two cows do not ghost."""
    image = image.copy()
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 48:
                pixels[x, y] = (red, green, blue, 255)
    return image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    mask = image.getchannel("A").point(lambda value: 255 if value > ALPHA_CUTOFF else 0)
    box = mask.getbbox()
    if box is None:
        raise ValueError("frame is empty")
    return box


def load_frame(directory: Path, index: int) -> Image.Image:
    path = directory / f"{index:02d}.png"
    image = Image.open(path).convert("RGBA")
    if image.size != (CANVAS, CANVAS):
        raise ValueError(f"{path} must be {CANVAS}x{CANVAS}, got {image.size}")
    return image


def overlaps_or_touches(calf: Image.Image, mom: Image.Image, offset_x: int) -> bool:
    calf_box = alpha_bbox(calf)
    mom_box = alpha_bbox(mom)
    mom_left = mom_box[0] + offset_x
    mom_right = mom_box[2] + offset_x
    gap = max(calf_box[0] - mom_right, mom_left - calf_box[2])
    return gap <= 1


def compose_frame(calf: Image.Image, mom: Image.Image, offset_x: int) -> Image.Image:
    if not overlaps_or_touches(calf, mom, offset_x):
        raise ValueError(f"mom offset {offset_x} would leave a gap; increase overlap")
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(harden_subject(calf), (0, 0))
    canvas.alpha_composite(harden_subject(mom), (offset_x, 0))
    box = alpha_bbox(canvas)
    if box[0] < 8 or box[2] > CANVAS - 8:
        raise ValueError(f"composite clips the canvas: bbox={box}")
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("calf_dir", type=Path)
    parser.add_argument("mom_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for index, offset_x in enumerate(MOM_OFFSETS_X, start=1):
        calf = load_frame(args.calf_dir, index)
        mom = load_frame(args.mom_dir, index)
        frame = compose_frame(calf, mom, offset_x)
        dest = args.output_dir / f"{index:02d}.png"
        frame.save(dest, optimize=True)
        print(f"wrote {dest} offset_x={offset_x} bbox={alpha_bbox(frame)}")


if __name__ == "__main__":
    main()
