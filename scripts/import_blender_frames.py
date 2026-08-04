#!/usr/bin/env python3
"""Import Blender-rendered PNG sequences into pets/library and write pet.json."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from PIL import Image

REQUIRED = {
    "idle": 4,
    "walk": 6,
    "sit": 4,
    "sleep": 4,
    "reaction": 4,
}
OPTIONAL = {
    "drag": 6,
    "climb": 6,
    "perch": 4,
    "hang": 4,
    "fall": 4,
    "impact": 4,
    "recover": 6,
}

DURATIONS = {
    "idle": [480, 360, 320, 480],
    "walk": [140] * 6,
    "sit": [220, 240, 280, 1800],
    "sleep": [700, 700, 500, 700],
    "reaction": [180, 220, 280, 1600],
    "drag": [120] * 6,
    "climb": [140] * 6,
    "perch": [280, 280, 280, 1600],
    "hang": [220, 220, 220, 1600],
    "fall": [120] * 4,
    "impact": [140, 180, 220, 900],
    "recover": [160, 160, 180, 200, 260, 700],
}

LOOP = {"idle", "walk", "sleep", "drag", "climb", "perch", "hang", "fall"}
CANVAS = 480
MARGIN = 16
TARGET_SPAN = 400
BASELINE = CANVAS - MARGIN
ALPHA_CUTOFF = 24


def list_frames(action_dir: Path, expected: int) -> list[Path]:
    frames = sorted(action_dir.glob("*.png"))
    # Ignore helper readmes accidentally saved as png — none expected
    frames = [p for p in frames if p.name.lower() != "readme.png"]
    if len(frames) < expected:
        raise SystemExit(f"{action_dir}: need {expected} PNG frames, found {len(frames)}")
    # Prefer 01.png style if present
    numbered = []
    for i in range(1, expected + 1):
        candidate = action_dir / f"{i:02d}.png"
        if candidate.exists():
            numbered.append(candidate)
    if len(numbered) == expected:
        return numbered
    return frames[:expected]


def normalize_frame(src: Path) -> Image.Image:
    image = Image.open(src).convert("RGBA")
    alpha = image.getchannel("A").point(lambda v: 255 if v > ALPHA_CUTOFF else 0)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit(f"empty frame: {src}")
    cropped = image.crop(box)
    span = max(cropped.width, cropped.height)
    scale = min(
        TARGET_SPAN / span,
        (CANVAS - 2 * MARGIN) / cropped.width,
        (CANVAS - 2 * MARGIN) / cropped.height,
    )
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - resized.width) // 2
    y = BASELINE - resized.height
    y = max(MARGIN, min(y, CANVAS - MARGIN - resized.height))
    canvas.alpha_composite(resized, (x, y))
    canvas.putpixel((0, 0), (0, 0, 0, 0))
    return canvas


def anim(paths: list[str], action: str) -> dict:
    durations = DURATIONS[action][: len(paths)]
    if len(durations) != len(paths):
        durations = ([130] * len(paths))
    return {
        "frames": paths,
        "durations": durations,
        "loop": action in LOOP,
        "holdLastFrame": action not in LOOP,
        "scale": 1,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--pet-id", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--personality", default="")
    parser.add_argument("--description", default="")
    parser.add_argument("--package-version", default="0.3.0")
    parser.add_argument("--normalize", action="store_true", default=True)
    parser.add_argument("--no-normalize", action="store_true")
    args = parser.parse_args()
    normalize = not args.no_normalize

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", args.pet_id):
        raise SystemExit("invalid pet id")

    work = args.work_dir
    renders = work / "renders"
    if not renders.is_dir():
        raise SystemExit(f"missing renders dir: {renders}")

    repo = Path(__file__).resolve().parents[1]
    lib = repo / "pets" / "library" / args.pet_id
    if lib.exists():
        shutil.rmtree(lib)
    lib.mkdir(parents=True)

    animations: dict = {}
    for action, count in REQUIRED.items():
        frames = list_frames(renders / action, count)
        out_dir = lib / "animations" / action
        out_dir.mkdir(parents=True)
        paths = []
        for index, frame in enumerate(frames, start=1):
            dest_name = f"{index:02d}.png"
            if normalize:
                normalize_frame(frame).save(out_dir / dest_name, optimize=True)
            else:
                shutil.copy2(frame, out_dir / dest_name)
            paths.append(f"animations/{action}/{dest_name}")
        animations[action] = anim(paths, action)

    for action, count in OPTIONAL.items():
        action_dir = renders / action
        if not action_dir.is_dir():
            continue
        pngs = [p for p in action_dir.glob("*.png")]
        if len(pngs) < count:
            print(f"skip optional {action}: need {count}, found {len(pngs)}")
            continue
        frames = list_frames(action_dir, count)
        out_dir = lib / "animations" / action
        out_dir.mkdir(parents=True)
        paths = []
        for index, frame in enumerate(frames, start=1):
            dest_name = f"{index:02d}.png"
            if normalize:
                normalize_frame(frame).save(out_dir / dest_name, optimize=True)
            else:
                shutil.copy2(frame, out_dir / dest_name)
            paths.append(f"animations/{action}/{dest_name}")
        animations[action] = anim(paths, action)

    preview_src = work / "preview.png"
    if not preview_src.exists():
        # fallback: first idle frame
        preview_src = lib / "animations" / "idle" / "01.png"
        shutil.copy2(preview_src, lib / "preview.png")
    else:
        if normalize:
            normalize_frame(preview_src).save(lib / "preview.png", optimize=True)
        else:
            shutil.copy2(preview_src, lib / "preview.png")

    personality = [p.strip() for p in args.personality.split(",") if p.strip()]
    description = args.description or "写实双宠桌面伴侣：柴犬旺财与橘猫咪咪。"

    interaction = {}
    if "drag" in animations:
        interaction["drag"] = {"action": "drag"}
    if "climb" in animations:
        interaction["climb"] = {"action": "climb", "anchor": {"x": 0.52, "y": 0.48}}
    if "perch" in animations:
        interaction["perch"] = {"action": "perch", "anchor": {"x": 0.5, "y": 0.55}}
    if "hang" in animations:
        interaction["hang"] = {"action": "hang", "anchor": {"x": 0.5, "y": 0.08}}
    if "fall" in animations:
        interaction["fall"] = {"action": "fall"}
    if "impact" in animations:
        interaction["impact"] = {"action": "impact"}
    if "recover" in animations:
        interaction["recover"] = {"action": "recover"}

    manifest = {
        "schemaVersion": 1,
        "packageVersion": args.package_version,
        "id": args.pet_id,
        "name": args.name,
        "description": description,
        "personality": personality or ["安静陪伴", "亲近", "默契"],
        "speechGender": "female",
        "defaultSize": "small",
        "preview": "preview.png",
        "normalizationMetric": "bbox-span-v1",
        "animations": animations,
        "behavior": {
            "random": [
                {"state": "walk", "weight": 36, "minDuration": 1600, "maxDuration": 4000},
                {"state": "sit", "weight": 28, "minDuration": 4500, "maxDuration": 7000, "message": "我们就在这儿待一会儿。"},
                {"state": "reaction", "weight": 22, "minDuration": 2400, "maxDuration": 3600, "message": "嗯？在叫我们吗。"},
                {"state": "sleep", "weight": 14, "minDuration": 5000, "maxDuration": 8000, "message": "……"},
            ],
            "perched": (
                [
                    {"state": "perch", "weight": 70, "minDuration": 3500, "maxDuration": 6500, "message": "风景还不错。"},
                    {"state": "reaction", "weight": 30, "minDuration": 2200, "maxDuration": 3400, "message": "你也看到了？"},
                ]
                if "perch" in animations
                else [{"state": "sit", "weight": 100, "minDuration": 3000, "maxDuration": 5000}]
            ),
        },
        "contextMenuActions": [
            {
                "id": "come-here",
                "label": "过来一下",
                "action": "reaction",
                "message": "来了。",
                "speech": "来了",
                "duration": 2800,
            },
            {
                "id": "rest",
                "label": "趴一会儿",
                "action": "sit",
                "message": "好，歇一下。",
                "speech": "歇一下",
                "duration": 3600,
            },
            {
                "id": "nap",
                "label": "去睡觉",
                "action": "sleep",
                "message": "那我们眯一会儿。",
                "duration": 4500,
            },
        ],
    }
    if interaction:
        manifest["interactionActions"] = interaction

    (lib / "pet.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lib)
    print("next:")
    print(f"  python skills/desktop-pet-maker/scripts/petpack_tool.py validate {lib}")
    print(
        "  python skills/desktop-pet-maker/scripts/petpack_tool.py build "
        f"{lib} pets/packages/{args.pet_id}.petpack"
    )


if __name__ == "__main__":
    main()
