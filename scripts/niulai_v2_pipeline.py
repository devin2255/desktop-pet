"""Batch pipeline for niulai-v2 strips: erase service watermark, remove chroma,
run the frame processor gates. Usage:
  python scripts/niulai_v2_pipeline.py idle:4 walk:6 ...
Each arg is action:framecount; expects raw/<action>.png.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
WORK = REPO / "pets" / "work" / "niulai-v2"
RAW = WORK / "raw"
CLEAN = WORK / "clean"
TRANSPARENT = WORK / "transparent"
FRAMES = WORK / "frames"
CHROMA_SCRIPT = Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"
PROCESSOR = REPO / "skills" / "desktop-pet-maker" / "scripts" / "process_animation_strips.py"
GREEN = (0, 255, 0, 255)


def has_character_pixels(image: Image.Image, box: tuple[int, int, int, int]) -> bool:
    """True if the box contains non-green, non-whitish pixels (character colors)."""
    x0, y0, x1, y1 = box
    crop = image.crop(box).convert("RGB")
    pixels = list(crop.getdata())
    for red, green, blue in pixels:
        is_green = green > 150 and red < 140 and blue < 140
        is_watermark = red > 140 and green > 140 and blue > 110  # whitish / pale green text
        if not is_green and not is_watermark:
            return True
    return False


def erase_watermark(image: Image.Image) -> Image.Image:
    width, height = image.size
    image = image.convert("RGBA")
    for y_frac, label in ((0.88, "tall"), (0.92, "short")):
        box = (int(width * 0.70), int(height * y_frac), width, height)
        if not has_character_pixels(image, box):
            for y in range(box[1], box[3]):
                for x in range(box[0], box[2]):
                    image.putpixel((x, y), GREEN)
            print(f"  watermark erased with {label} box {box}")
            return image
    print("  WARNING: watermark box overlaps character; not erased")
    return image


def main() -> int:
    failed = []
    for spec in sys.argv[1:]:
        action, _, count = spec.partition(":")
        raw_path = RAW / f"{action}.png"
        if not raw_path.exists():
            print(f"[{action}] missing raw strip"); failed.append(action); continue
        print(f"[{action}] cleaning watermark")
        image = Image.open(raw_path)
        cleaned = erase_watermark(image)
        clean_path = CLEAN / f"{action}.png"
        CLEAN.mkdir(parents=True, exist_ok=True)
        cleaned.save(clean_path)

        print(f"[{action}] removing chroma")
        transparent_path = TRANSPARENT / f"{action}.png"
        TRANSPARENT.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            [sys.executable, str(CHROMA_SCRIPT), "--input", str(clean_path), "--out", str(transparent_path),
             "--auto-key", "border", "--soft-matte", "--transparent-threshold", "12",
             "--opaque-threshold", "220", "--despill", "--edge-contract", "3", "--force"],
            capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[{action}] chroma FAILED\n{result.stdout}\n{result.stderr}")
            failed.append(action); continue

        print(f"[{action}] processing strip")
        in_dir = WORK / "proc-in" / action
        out_dir = FRAMES / action
        in_dir.mkdir(parents=True, exist_ok=True)
        single = in_dir / f"{action}.png"
        single.unlink(missing_ok=True)
        import shutil
        shutil.copyfile(transparent_path, single)
        result = subprocess.run(
            [sys.executable, str(PROCESSOR), "--input-dir", str(in_dir),
             "--output-dir", str(out_dir), "--action", f"{action}:{count}"],
            capture_output=True, text=True)
        print(result.stdout.strip()[-1500:] if result.stdout else "")
        if result.returncode != 0:
            print(f"[{action}] PROCESS FAILED\n{result.stderr[-1500:]}")
            failed.append(action)
    if failed:
        print("FAILED ACTIONS:", ", ".join(failed))
        return 1
    print("ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
