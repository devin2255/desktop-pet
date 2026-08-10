from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


DEFAULTS = {
    "idle": {"durations": [420, 300, 260, 420], "loop": True},
    "walk": {"durations": [130] * 6, "loop": True},
    "sit": {"durations": [220, 220, 260, 2000], "loop": False, "holdLastFrame": True},
    "sleep": {"durations": [650, 650, 420, 650], "loop": True, "scale": 0.88},
    "reaction": {"durations": [160, 180, 220, 1500], "loop": False, "holdLastFrame": True},
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--personality", default="")
    parser.add_argument("--description", default="")
    parser.add_argument("--package-version", default="1.0.0")
    parser.add_argument("--preview", type=Path, required=True)
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--pet-dir", type=Path, required=True)
    parser.add_argument("--watch", type=Path, default=None,
                        help="可选 JSON 文件，内容为 watch 配置对象，写入 manifest 的 watch 字段")
    args = parser.parse_args()

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", args.id):
        raise SystemExit("id must use 2-48 lowercase ASCII letters, numbers, or hyphens")
    if args.pet_dir.exists() and any(args.pet_dir.iterdir()):
        raise SystemExit(f"pet directory is not empty: {args.pet_dir}")

    template = Path(__file__).resolve().parents[1] / "assets" / "manifest-template.json"
    manifest = json.loads(template.read_text(encoding="utf-8"))
    manifest.update({
        "id": args.id,
        "name": args.name,
        "description": args.description,
        "personality": [item.strip() for item in args.personality.split(",") if item.strip()],
        "packageVersion": args.package_version,
        "normalizationMetric": "alpha-area-v1",
    })

    if args.watch is not None:
        watch_data = json.loads(args.watch.read_text(encoding="utf-8"))
        if not isinstance(watch_data, dict):
            raise SystemExit(f"--watch must contain a JSON object, got {type(watch_data).__name__}")
        manifest["watch"] = watch_data

    args.pet_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.preview, args.pet_dir / "preview.png")
    for action, config in DEFAULTS.items():
        source = args.frames_dir / action
        target = args.pet_dir / "animations" / action
        target.mkdir(parents=True, exist_ok=True)
        frame_files = sorted(source.glob("*.png"))
        if len(frame_files) != len(config["durations"]):
            raise SystemExit(f"{action}: expected {len(config['durations'])} frames, found {len(frame_files)}")
        paths = []
        for frame in frame_files:
            shutil.copy2(frame, target / frame.name)
            paths.append(f"animations/{action}/{frame.name}")
        manifest["animations"][action] = {"frames": paths, **config}

    (args.pet_dir / "pet.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(args.pet_dir / "pet.json")


if __name__ == "__main__":
    main()
