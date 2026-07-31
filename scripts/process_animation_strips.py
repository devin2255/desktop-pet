from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_COUNTS = {
    "idle": 4,
    "walk": 6,
    "sit": 4,
    "sleep": 4,
    "reaction": 4,
}


def split_strip(source: Path, output_root: Path, action: str, frame_count: int) -> None:
    image = Image.open(source).convert("RGBA")
    action_dir = output_root / action
    action_dir.mkdir(parents=True, exist_ok=True)

    left_edges = [round(index * image.width / frame_count) for index in range(frame_count + 1)]
    frames: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []

    for index in range(frame_count):
        frame = image.crop((left_edges[index], 0, left_edges[index + 1], image.height))
        alpha_box = frame.getchannel("A").getbbox()
        if alpha_box is None:
            raise ValueError(f"{action} frame {index + 1} is empty")
        frames.append(frame)
        boxes.append(alpha_box)

    max_subject_width = max(box[2] - box[0] for box in boxes)
    max_subject_height = max(box[3] - box[1] for box in boxes)
    canvas_width = max_subject_width + 32
    canvas_height = max_subject_height + 28
    baseline = canvas_height - 12

    for index, (frame, box) in enumerate(zip(frames, boxes), start=1):
        subject = frame.crop(box)
        canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
        x = (canvas_width - subject.width) // 2
        y = baseline - subject.height
        canvas.alpha_composite(subject, (x, y))
        canvas.save(action_dir / f"{index:02d}.png", optimize=True)

    print(f"{action}: {frame_count} frames, canvas={canvas_width}x{canvas_height}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    for action, frame_count in FRAME_COUNTS.items():
        split_strip(args.input_dir / f"{action}.png", args.output_dir, action, frame_count)


if __name__ == "__main__":
    main()
