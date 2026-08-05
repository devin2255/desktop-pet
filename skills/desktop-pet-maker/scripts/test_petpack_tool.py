from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
import json
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import petpack_tool


class PetpackArchiveSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fixture = SCRIPT_DIR.parents[2] / "pets" / "packages" / "xiaogou.petpack"

    def copy_with_extra(self, destination: Path, name: str, content: bytes = b"extra") -> None:
        with zipfile.ZipFile(self.fixture) as source, zipfile.ZipFile(destination, "w") as target:
            for info in source.infolist():
                target.writestr(info, source.read(info.filename))
            target.writestr(name, content)

    def test_reviewed_demo_package_is_valid(self) -> None:
        manifest = petpack_tool.validate_archive(self.fixture)
        self.assertEqual(manifest["id"], "xiaogou")

    def test_extra_file_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "extra.petpack"
            self.copy_with_extra(archive, "private/notes.txt")
            with self.assertRaisesRegex(ValueError, "unreferenced package file"):
                petpack_tool.validate_archive(archive)

    def test_case_collision_is_rejected_before_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "collision.petpack"
            self.copy_with_extra(archive, "PET.JSON", b"{}")
            with self.assertRaisesRegex(ValueError, "duplicate or case-colliding"):
                petpack_tool.validate_archive(archive)

    def test_backslash_and_traversal_paths_are_rejected(self) -> None:
        for value in ("private\\notes.txt", "../preview.png", "C:/preview.png"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                petpack_tool.safe_relative(value)

    def test_interaction_actions_validate_roles_animation_references_and_anchors(self) -> None:
        with zipfile.ZipFile(self.fixture) as source:
            manifest = json.loads(source.read("pet.json"))
        manifest["interactionActions"] = {
            "drag": {"action": "walk"},
            "perch": {"action": "sit", "anchor": {"x": 0.5, "y": 0.7}},
        }
        petpack_tool.validate_manifest_shape(manifest)
        manifest["interactionActions"]["perch"]["anchor"]["x"] = -0.01
        with self.assertRaisesRegex(ValueError, "anchor"):
            petpack_tool.validate_manifest_shape(manifest)
        manifest["interactionActions"]["perch"]["anchor"]["x"] = 0.5
        manifest["interactionActions"]["perch"]["action"] = "missing"
        with self.assertRaisesRegex(ValueError, "unknown animation"):
            petpack_tool.validate_manifest_shape(manifest)
        manifest["interactionActions"]["perch"]["action"] = "sit"
        manifest["interactionActions"]["unknown"] = {"action": "sit"}
        with self.assertRaisesRegex(ValueError, "unsupported role"):
            petpack_tool.validate_manifest_shape(manifest)
        del manifest["interactionActions"]["unknown"]
        manifest["interactionActions"]["perch"]["anchor"]["x"] = True
        with self.assertRaisesRegex(ValueError, "anchor"):
            petpack_tool.validate_manifest_shape(manifest)
        manifest["interactionActions"]["perch"]["anchor"] = None
        with self.assertRaisesRegex(ValueError, "anchor"):
            petpack_tool.validate_manifest_shape(manifest)

    def test_interaction_animation_receives_full_structural_validation(self) -> None:
        with zipfile.ZipFile(self.fixture) as source:
            manifest = json.loads(source.read("pet.json"))
        manifest["animations"]["climb"] = {}
        manifest["interactionActions"] = {"climb": {"action": "climb"}}
        with self.assertRaisesRegex(ValueError, "climb"):
            petpack_tool.validate_manifest_shape(manifest)

    def test_schema_v1_legacy_behavior_random_can_contain_sleep(self) -> None:
        with zipfile.ZipFile(self.fixture) as source:
            manifest = json.loads(source.read("pet.json"))
        manifest["behavior"] = {
            "random": [{"state": "sleep", "weight": 1, "minDuration": 600, "maxDuration": 1000}]
        }
        petpack_tool.validate_manifest_shape(manifest)

    def test_sequences_and_context_menu_sequence_validation(self) -> None:
        def make_animation(action: str, frame_count: int, loop: bool = False) -> dict:
            frames = [f"animations/{action}/{index:02d}.png" for index in range(1, frame_count + 1)]
            return {"frames": frames, "durations": [100] * frame_count, "loop": loop, "scale": 1}

        manifest = {
            "schemaVersion": 1,
            "id": "demo-seq",
            "name": "Demo",
            "personality": ["x"],
            "preview": "preview.png",
            "animations": {
                "idle": make_animation("idle", 4, True),
                "walk": make_animation("walk", 6, True),
                "sit": make_animation("sit", 4),
                "sleep": make_animation("sleep", 4, True),
                "reaction": make_animation("reaction", 4),
                "relax-a": make_animation("relax-a", 1),
                "relax-b": make_animation("relax-b", 1),
            },
            "behavior": {"random": [{"state": "walk", "weight": 1, "minDuration": 1000, "maxDuration": 2000}]},
            "sequences": {
                "relax": {
                    "stages": [
                        {"action": "relax-a", "message": "hi", "duration": 1000},
                        {"action": "relax-b", "messages": ["我要这个", "我要这个"], "waitForClick": True},
                        {"action": "idle", "duration": 0},
                    ]
                }
            },
            "contextMenuActions": [{"id": "relax", "label": "去放松", "sequence": "relax"}],
        }
        petpack_tool.validate_manifest_shape(manifest)
        manifest["contextMenuActions"] = [
            {"id": "relax", "label": "去放松", "action": "reaction", "sequence": "relax"}
        ]
        with self.assertRaisesRegex(ValueError, "exactly one"):
            petpack_tool.validate_manifest_shape(manifest)
        manifest["contextMenuActions"] = [{"id": "relax", "label": "去放松", "sequence": "missing"}]
        with self.assertRaisesRegex(ValueError, "unknown sequence"):
            petpack_tool.validate_manifest_shape(manifest)


if __name__ == "__main__":
    unittest.main()
