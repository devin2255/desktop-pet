from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from process_animation_strips import (
    BASELINE,
    VISUAL_CENTER_X,
    alpha_geometry,
    alpha_mask,
    load_subjects,
    parse_action_counts,
    render_action,
)


class AnimationStripSafetyTests(unittest.TestCase):
    def test_parse_custom_action_counts(self) -> None:
        self.assertEqual(
            parse_action_counts(["climb:6", "perch:4", "hang:4"]),
            {"climb": 6, "perch": 4, "hang": 4},
        )
        with self.assertRaisesRegex(ValueError, "name:count"):
            parse_action_counts(["climb"])

    def make_strip(self, path: Path, mode: str = "valid") -> None:
        cell_width, height, count = 120, 120, 4
        strip = Image.new("RGBA", (cell_width * count, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(strip)
        for index in range(count):
            offset = index * cell_width
            draw.ellipse((offset + 35, 25, offset + 85, 100), fill=(210, 120, 80, 255))
        if mode == "bleed":
            draw.rectangle((112, 55, 120, 70), fill=(0, 0, 0, 255))
        elif mode == "clipped_tail":
            draw.rectangle((20, 58, 40, 68), fill=(210, 120, 80, 255))
            draw.rectangle((20, 52, 24, 74), fill=(210, 120, 80, 255))
            draw.rectangle((24, 58, 37, 68), fill=(210, 120, 80, 255))
        elif mode == "fragment":
            draw.rectangle((15, 20, 25, 30), fill=(0, 0, 0, 255))
        strip.save(path)

    def test_safe_strip_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "idle.png"
            self.make_strip(source)
            self.assertEqual(len(load_subjects(source, 4)), 4)

    def test_neighbor_cell_bleeding_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "idle.png"
            self.make_strip(source, "bleed")
            with self.assertRaisesRegex(ValueError, "safety gutter"):
                load_subjects(source, 4)

    def test_flat_clipped_tail_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "idle.png"
            self.make_strip(source, "clipped_tail")
            with self.assertRaisesRegex(ValueError, "flat side edge"):
                load_subjects(source, 4)

    def test_detached_neighbor_fragment_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "idle.png"
            self.make_strip(source, "fragment")
            with self.assertRaisesRegex(ValueError, "detached fragment"):
                load_subjects(source, 4)

    def test_rendering_uses_stable_visual_centroid_and_baseline(self) -> None:
        subjects = []
        for tail_length in (8, 12, 16, 20):
            subject = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
            draw = ImageDraw.Draw(subject)
            draw.ellipse((30, 15, 80, 95), fill=(210, 120, 80, 255))
            draw.polygon(
                [(32, 60), (30 - tail_length, 66), (32, 72), (42, 66)],
                fill=(210, 120, 80, 255),
            )
            subjects.append(subject.crop(alpha_mask(subject).getbbox()))

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_action(subjects, output, "reaction")
            for frame_path in sorted((output / "reaction").glob("*.png")):
                frame = Image.open(frame_path).convert("RGBA")
                _, centroid_x = alpha_geometry(frame)
                box = alpha_mask(frame).getbbox()
                self.assertAlmostEqual(centroid_x, VISUAL_CENTER_X, delta=1.5)
                self.assertEqual(box[3], BASELINE)


    def test_rendering_normalizes_visual_mass_across_pose_shapes(self) -> None:
        subjects = []
        for box in ((75, 10, 125, 190), (10, 75, 190, 125), (35, 35, 165, 165)):
            subject = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
            ImageDraw.Draw(subject).ellipse(box, fill=(210, 120, 80, 255))
            subjects.append(subject.crop(alpha_mask(subject).getbbox()))

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render_action(subjects, output, "idle")
            areas = []
            for frame_path in sorted((output / "idle").glob("*.png")):
                frame = Image.open(frame_path).convert("RGBA")
                area, centroid_x = alpha_geometry(frame)
                areas.append(area)
                self.assertAlmostEqual(centroid_x, VISUAL_CENTER_X, delta=1.5)
                self.assertEqual(alpha_mask(frame).getbbox()[3], BASELINE)
            self.assertLessEqual(max(areas) / min(areas), 1.08)


if __name__ == "__main__":
    unittest.main()
