from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
import json
from io import BytesIO
from pathlib import Path

from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import petpack_tool


class PetpackArchiveSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fixture_temp = tempfile.TemporaryDirectory()
        cls.fixture = Path(cls.fixture_temp.name) / "xiaogou.petpack"
        manifest = cls.base_manifest()
        manifest["id"] = "xiaogou"
        with zipfile.ZipFile(cls.fixture, "w") as package:
            package.writestr("pet.json", json.dumps(manifest, ensure_ascii=False).encode("utf-8"))
            png = cls.sample_png()
            for relative in sorted(petpack_tool.referenced_files(manifest) - {"pet.json"}):
                package.writestr(relative, png)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.fixture_temp.cleanup()

    @staticmethod
    def sample_png() -> bytes:
        image = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        image.putpixel((1, 1), (255, 0, 0, 255))
        output = BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()

    @staticmethod
    def make_animation(action: str, frame_count: int, loop: bool = False) -> dict:
        frames = [f"animations/{action}/{index:02d}.png" for index in range(1, frame_count + 1)]
        return {"frames": frames, "durations": [100] * frame_count, "loop": loop, "scale": 1}

    @classmethod
    def base_manifest(cls) -> dict:
        return {
            "schemaVersion": 1,
            "id": "demo-seq",
            "name": "Demo",
            "personality": ["x"],
            "preview": "preview.png",
            "animations": {
                "idle": cls.make_animation("idle", 4, True),
                "walk": cls.make_animation("walk", 6, True),
                "sit": cls.make_animation("sit", 4),
                "sleep": cls.make_animation("sleep", 4, True),
                "reaction": cls.make_animation("reaction", 4),
            },
        }

    @classmethod
    def member_animations(cls, member_id: str) -> dict:
        return {
            "idle": cls.make_animation(f"{member_id}/idle", 4, True),
            "walk": cls.make_animation(f"{member_id}/walk", 6, True),
            "sit": cls.make_animation(f"{member_id}/sit", 4),
            "sleep": cls.make_animation(f"{member_id}/sleep", 4, True),
            "reaction": cls.make_animation(f"{member_id}/reaction", 4),
        }

    @classmethod
    def duo_manifest(cls) -> dict:
        manifest = cls.base_manifest()
        manifest["duo"] = {
            "gesture": {"menuSlopPx": 12, "commitPx": 48, "snapProgress": 0.5},
            "members": [
                {
                    "id": "judge",
                    "side": "left",
                    "name": "兄弟判官",
                    "watch": True,
                    "animations": cls.member_animations("judge"),
                },
                {
                    "id": "floral",
                    "side": "right",
                    "name": "花袄弟",
                    "watch": False,
                    "animations": cls.member_animations("floral"),
                },
            ],
        }
        return manifest

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
        for field, value in (
            ("speech", "not supported"),
            ("speechAudio", "audio/not-supported.mp3"),
        ):
            with self.subTest(field=field):
                manifest["contextMenuActions"] = [
                    {"id": "relax", "label": "去放松", "sequence": "relax", field: value}
                ]
                with self.assertRaisesRegex(ValueError, "sequence.*speech"):
                    petpack_tool.validate_manifest_shape(manifest)
        manifest["contextMenuActions"] = [
            {
                "id": "react",
                "label": "互动",
                "action": "reaction",
                "speech": "hello",
                "speechAudio": "audio/hello.mp3",
            }
        ]
        petpack_tool.validate_manifest_shape(manifest)

    def test_duo_manifest_validates_and_references_member_frames(self) -> None:
        manifest = self.duo_manifest()
        petpack_tool.validate_manifest_shape(manifest)
        referenced = petpack_tool.referenced_files(manifest)
        self.assertIn("animations/judge/idle/01.png", referenced)
        self.assertIn("animations/floral/reaction/04.png", referenced)

    def test_duo_manifest_requires_two_members(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["members"] = manifest["duo"]["members"][:1]
        with self.assertRaisesRegex(ValueError, "duo.*members"):
            petpack_tool.validate_manifest_shape(manifest)

    def test_duo_manifest_root_member_path_collision_uses_contract_error(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["members"][0]["animations"]["idle"]["frames"][0] = manifest["animations"]["idle"]["frames"][0]
        with self.assertRaisesRegex(ValueError, "动画路径冲突"):
            petpack_tool.validate_manifest_shape(manifest)

    def test_duo_tent_validates(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["tent"] = {
            "action": "sit",
            "enterLabel": "支起来",
            "leaveLabel": "收起来",
            "openProgress": 0.48,
        }
        petpack_tool.validate_manifest_shape(manifest)

    def test_duo_tent_rejects_invalid_open_progress(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["tent"] = {"openProgress": 0.2}
        with self.assertRaisesRegex(ValueError, "openProgress"):
            petpack_tool.validate_manifest_shape(manifest)

    def test_duo_slack_validates(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["slack"] = {
            "jumpAction": "idle",
            "carryAction": "walk",
            "clips": ["video/slack/01.webm"],
        }
        petpack_tool.validate_manifest_shape(manifest)
        self.assertIn("video/slack/01.webm", petpack_tool.referenced_files(manifest))

    def test_duo_slack_rejects_empty_clips(self) -> None:
        manifest = self.duo_manifest()
        manifest["duo"]["slack"] = {
            "jumpAction": "idle",
            "carryAction": "walk",
            "clips": [],
        }
        with self.assertRaisesRegex(ValueError, "clips"):
            petpack_tool.validate_manifest_shape(manifest)


if __name__ == "__main__":
    unittest.main()
