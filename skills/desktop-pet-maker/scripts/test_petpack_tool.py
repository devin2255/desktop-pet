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


if __name__ == "__main__":
    unittest.main()
