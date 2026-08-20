"""
Extract frames from a horizontal chroma-key strip and output normalized 480x480 PNGs.
Used for special non-looping animations (call-shout, call-mom-approach) that need
proportional scaling rather than foot-baseline alignment.

Usage:
    python scripts/make_call_frames.py --strip path/to/strip.png --count 4 --out pets/library/niulai/animations/call-shout
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from PIL import Image

CANVAS = 480
GUTTER = 32  # min transparent border on each side


def is_green(r: int, g: int, b: int) -> bool:
    return g > 150 and r < 160 and b < 160


def remove_green(img: Image.Image) -> Image.Image:
    """Replace green-screen pixels with transparent."""
    out = img.convert("RGBA")
    pixels = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if is_green(r, g, b):
                pixels[x, y] = (0, 0, 0, 0)
    return out


def subject_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    mask = img.getchannel("A").point(lambda v: 255 if v > 20 else 0)
    return mask.getbbox()


def extract_frames(strip_path: Path, count: int) -> list[Image.Image]:
    strip = Image.open(strip_path).convert("RGBA")
    cell_w = strip.width // count
    frames = []
    for i in range(count):
        cell = strip.crop((i * cell_w, 0, (i + 1) * cell_w, strip.height))
        frames.append(cell)
    return frames


def normalize_frame(frame: Image.Image, ref_height: int | None = None) -> Image.Image:
    """Remove green, scale to fit canvas with proportional approach support."""
    cleaned = remove_green(frame)
    box = subject_bbox(cleaned)
    if box is None:
        return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    subject = cleaned.crop(box)
    subj_w, subj_h = subject.size

    # Scale so the subject fits within (CANVAS - 2*GUTTER) while preserving ratio.
    # If ref_height is given, scale relative to that (for approach: biggest frame sets baseline).
    max_dim = CANVAS - 2 * GUTTER
    if ref_height is None:
        scale = min(max_dim / subj_w, max_dim / subj_h)
    else:
        scale = min((ref_height / subj_h), max_dim / subj_w, max_dim / subj_h)

    new_w = max(1, round(subj_w * scale))
    new_h = max(1, round(subj_h * scale))
    scaled = subject.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    # Foot-bottom align: place subject so feet sit at bottom gutter line
    x = (CANVAS - new_w) // 2
    y = CANVAS - GUTTER - new_h
    canvas.alpha_composite(scaled, (x, max(0, y)))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strip", required=True, type=Path)
    parser.add_argument("--count", required=True, type=int)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--approach", action="store_true",
                        help="Preserve relative size differences (for walk-near sequences)")
    args = parser.parse_args()

    frames = extract_frames(args.strip, args.count)
    cleaned = [remove_green(f) for f in frames]
    bboxes = [subject_bbox(c) for c in cleaned]

    if args.approach:
        # Find the largest subject height (last frame = closest)
        max_h = max(
            (b[3] - b[1]) for b in bboxes if b is not None
        )
        ref_h = round((CANVAS - 2 * GUTTER) * 0.88)  # largest frame fills 88% of canvas
        scale_factor = ref_h / max_h
    else:
        scale_factor = None
        ref_h = None

    args.out.mkdir(parents=True, exist_ok=True)
    for i, (cell, box) in enumerate(zip(cleaned, bboxes), start=1):
        if box is None:
            canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        else:
            subject = cell.crop(box)
            subj_w, subj_h = subject.size
            if args.approach:
                scale = scale_factor
            else:
                max_dim = CANVAS - 2 * GUTTER
                scale = min(max_dim / subj_w, max_dim / subj_h)

            new_w = max(1, round(subj_w * scale))
            new_h = max(1, round(subj_h * scale))
            scaled = subject.resize((new_w, new_h), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
            x = (CANVAS - new_w) // 2
            y = CANVAS - GUTTER - new_h
            canvas.alpha_composite(scaled, (x, max(0, y)))

        dest = args.out / f"{i:02d}.png"
        canvas.save(dest, optimize=True)
        box2 = subject_bbox(canvas)
        print(f"  frame {i:02d}: bbox={box2}")

    print(f"OK -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
