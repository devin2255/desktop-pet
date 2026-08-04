#!/usr/bin/env python3
"""Create a local Blender worktree for a dual-pet package."""

from __future__ import annotations

import argparse
from pathlib import Path

ACTIONS = {
    "idle": 4,
    "walk": 6,
    "sit": 4,
    "sleep": 4,
    "reaction": 4,
    "drag": 6,
    "climb": 6,
    "perch": 4,
    "hang": 4,
    "fall": 4,
    "impact": 4,
    "recover": 6,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold Blender free workflow folders")
    parser.add_argument("--pet-id", default="dog-and-cat")
    parser.add_argument("--root", type=Path, default=None, help="Repo root (default: auto)")
    args = parser.parse_args()

    root = args.root or Path(__file__).resolve().parents[1]
    work = root / "pets" / "work" / f"{args.pet_id}-blender"
    blender_dir = work / "blender"
    renders = work / "renders"

    blender_dir.mkdir(parents=True, exist_ok=True)
    for action, count in ACTIONS.items():
        action_dir = renders / action
        action_dir.mkdir(parents=True, exist_ok=True)
        readme = action_dir / "README.txt"
        if not readme.exists():
            readme.write_text(
                f"Put {count} PNG frames here named 01.png .. {count:02d}.png\n"
                "RGBA transparent, preferably 480x480, shared camera and foot baseline.\n",
                encoding="utf-8",
            )

    notes = work / "NOTES.md"
    if not notes.exists():
        lines = [
            f"# {args.pet_id} Blender checklist",
            "",
            "- [ ] Install Blender (free)",
            f"- [ ] Save blend to `{blender_dir.as_posix()}/dog-and-cat.blend`",
            "- [ ] Shared camera Cam_Pet + Ground_Baseline",
            "- [ ] Transparent film, PNG RGBA",
            "",
            "## Actions",
            "",
        ]
        for action, count in ACTIONS.items():
            lines.append(f"- [ ] `{action}` x {count}")
        lines.extend(
            [
                "",
                "## After idle is ready",
                "",
                "```powershell",
                "python scripts/import_blender_frames.py --work-dir "
                f"pets/work/{args.pet_id}-blender --pet-id {args.pet_id} "
                '--name "旺财与咪咪" --personality "安静陪伴,亲近,默契"',
                "```",
                "",
                "Guide: docs/blender-free-dog-and-cat.md",
                "",
            ]
        )
        notes.write_text("\n".join(lines), encoding="utf-8")

    print(work)


if __name__ == "__main__":
    main()
