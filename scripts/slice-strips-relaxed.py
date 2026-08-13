"""Slice animation strips into normalized frames without strict gutter validation.
Based on process_animation_strips.py but with relaxed checks for AI-generated strips."""
import sys
from pathlib import Path
from math import sqrt
from PIL import Image, ImageDraw

CANVAS_SIZE = 480
CANVAS_MARGIN = 16
TARGET_SUBJECT_SPAN = 400
BASELINE = CANVAS_SIZE - CANVAS_MARGIN
VISUAL_CENTER_X = CANVAS_SIZE // 2
TARGET_ALPHA_AREA = 38000
ALPHA_CUTOFF = 24

def alpha_mask(image):
    return image.getchannel("A").point(lambda v: 255 if v > ALPHA_CUTOFF else 0)

def alpha_geometry(image):
    mask = alpha_mask(image)
    width = mask.size[0]
    area = 0
    weighted_x = 0
    pixels = mask.get_flattened_data() if hasattr(mask, "get_flattened_data") else mask.getdata()
    for offset, value in enumerate(pixels):
        if not value:
            continue
        area += 1
        weighted_x += offset % width
    if area == 0:
        return 0, 0.0
    return area, weighted_x / area

def slice_strip(strip_path, frame_count):
    """Slice a strip into equal-width cells and crop to subject bounding box."""
    image = Image.open(strip_path).convert("RGBA")
    edges = [round(i * image.width / frame_count) for i in range(frame_count + 1)]
    subjects = []
    for i in range(frame_count):
        cell = image.crop((edges[i], 0, edges[i+1], image.height))
        mask = alpha_mask(cell)
        box = mask.getbbox()
        if box is None:
            print(f"  WARNING: {strip_path.stem} frame {i+1} is empty, skipping")
            continue
        # Add small padding
        pad = 4
        left = max(0, box[0] - pad)
        top = max(0, box[1] - pad)
        right = min(cell.width, box[2] + pad)
        bottom = min(cell.height, box[3] + pad)
        subject = cell.crop((left, top, right, bottom))
        subjects.append(subject)
    return subjects

def render_action(subjects, output_root, action):
    output_dir = output_root / action
    output_dir.mkdir(parents=True, exist_ok=True)
    for index, subject in enumerate(subjects, start=1):
        area, centroid_x = alpha_geometry(subject)
        if area == 0:
            continue
        area_scale = sqrt(TARGET_ALPHA_AREA / area) if area > 0 else 1.0
        fit_scale = min(
            TARGET_SUBJECT_SPAN / max(1, subject.width),
            TARGET_SUBJECT_SPAN / max(1, subject.height),
        )
        scale = min(area_scale, fit_scale)
        size = (
            max(1, round(subject.width * scale)),
            max(1, round(subject.height * scale)),
        )
        resized = subject.resize(size, Image.Resampling.LANCZOS)
        _, resized_centroid_x = alpha_geometry(resized)
        canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
        x = round(VISUAL_CENTER_X - resized_centroid_x)
        y = BASELINE - resized.height
        canvas.alpha_composite(resized, (x, y))
        canvas.save(output_dir / f"{index:02d}.png", optimize=True)
    print(f"  {action}: {len(subjects)} frames rendered")

def main():
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    # Parse action:count pairs from remaining args
    actions = {}
    for arg in sys.argv[3:]:
        name, sep, count = arg.partition(":")
        if sep and count.isdigit():
            actions[name] = int(count)
    if not actions:
        actions = {"idle": 4, "walk": 6, "sit": 4, "sleep": 4, "reaction": 4}
    for action, count in actions.items():
        strip_path = input_dir / f"{action}.png"
        if not strip_path.exists():
            print(f"  WARNING: {strip_path} not found, skipping {action}")
            continue
        print(f"Processing {action} ({count} frames)...")
        subjects = slice_strip(strip_path, count)
        if subjects:
            render_action(subjects, output_dir, action)
    print("Done!")

if __name__ == "__main__":
    main()
