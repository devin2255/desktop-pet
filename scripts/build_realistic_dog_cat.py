from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[1]
ASSETS = Path(r"C:\Users\Thinkpad\.cursor\projects\d-Vibe-Coding-desktop-pet\assets")
WORK = REPO / "pets" / "work" / "dog-and-cat"
LIB = REPO / "pets" / "library" / "dog-and-cat"
PKG = REPO / "pets" / "packages" / "dog-and-cat.petpack"
CANVAS = 480
MARGIN = 16
TARGET_SPAN = 400
BASELINE = CANVAS - MARGIN
CENTER_X = CANVAS // 2
ALPHA_CUTOFF = 24


def chroma_key(src: Image.Image) -> Image.Image:
    """Remove near-green background with soft matte + mild despill."""
    rgba = src.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Border-sampled chroma is pure green; also catch near-green.
            green_dom = g > 90 and g > r * 1.35 and g > b * 1.35
            very_green = g > 160 and r < 120 and b < 120
            if green_dom or very_green:
                # Soft matte: how green vs subject
                score = (g - max(r, b)) / 255.0
                if score > 0.35 or very_green:
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    # Edge fringe: despill and lower alpha
                    nr = min(255, int(r + (max(r, b) - g) * 0.35))
                    nb = min(255, int(b + (max(r, b) - g) * 0.35))
                    ng = min(nr, nb)
                    alpha = max(0, min(255, int(255 * (1.0 - score * 2.2))))
                    pixels[x, y] = (nr, ng, nb, alpha)
            elif g > r + 25 and g > b + 25 and g > 100:
                # Mild despill on fur edges
                ng = min(g, int((r + b) / 2 + 8))
                pixels[x, y] = (r, ng, b, a)
    return rgba


def subject_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = img.getchannel("A").point(lambda v: 255 if v > ALPHA_CUTOFF else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("empty after chroma key")
    return box


def place_on_canvas(subject: Image.Image, bob_y: int = 0) -> Image.Image:
    box = subject_bbox(subject)
    cropped = subject.crop(box)
    span = max(cropped.width, cropped.height)
    scale = TARGET_SPAN / span
    # Keep slightly smaller to avoid edge clip with dual pets
    scale = min(scale, (CANVAS - 2 * MARGIN) / cropped.width, (CANVAS - 2 * MARGIN) / cropped.height)
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - resized.width) // 2
    y = BASELINE - resized.height + bob_y
    y = max(MARGIN, min(y, CANVAS - MARGIN - resized.height))
    canvas.alpha_composite(resized, (x, y))
    # Ensure corner transparent for validator
    px = canvas.load()
    px[0, 0] = (0, 0, 0, 0)
    return canvas


def split_equal_cells(img: Image.Image, count: int) -> list[Image.Image]:
    edges = [round(i * img.width / count) for i in range(count + 1)]
    return [img.crop((edges[i], 0, edges[i + 1], img.height)) for i in range(count)]


def frames_from_pose(keyed: Image.Image, count: int, bob: float = 2.0) -> list[Image.Image]:
    out = []
    for i in range(count):
        dy = int(round(math.sin(i * math.pi / max(1, count / 2)) * bob))
        out.append(place_on_canvas(keyed, bob_y=dy))
    return out


def frames_from_strip_or_pose(path: Path, count: int, prefer_strip: bool = False) -> list[Image.Image]:
    keyed = chroma_key(Image.open(path))
    if prefer_strip:
        cells = split_equal_cells(keyed, count)
        # Accept strip only if every cell has substantial subject
        ok = True
        areas = []
        for cell in cells:
            try:
                box = subject_bbox(cell)
                area = (box[2] - box[0]) * (box[3] - box[1])
                areas.append(area)
                if area < keyed.width * keyed.height * 0.01:
                    ok = False
            except ValueError:
                ok = False
                break
        if ok and max(areas) / max(1, min(areas)) < 2.5:
            return [place_on_canvas(cell) for cell in cells]
    return frames_from_pose(keyed, count)


def save_action(name: str, frames: list[Image.Image]) -> list[str]:
    out_dir = LIB / "animations" / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, frame in enumerate(frames, start=1):
        rel = f"animations/{name}/{i:02d}.png"
        frame.save(LIB / rel, optimize=True)
        paths.append(rel)
    return paths


def anim(frames: list[str], durations: list[int], loop: bool) -> dict:
    return {
        "frames": frames,
        "durations": durations,
        "loop": loop,
        "holdLastFrame": not loop,
        "scale": 1,
    }


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    if LIB.exists():
        shutil.rmtree(LIB)
    LIB.mkdir(parents=True)

    # Copy sources into work
    needed = [
        "dog-cat-master.png",
        "idle-chroma.png",
        "walk-01.png",
        "walk-02.png",
        "sit-pose.png",
        "sleep-pose.png",
        "reaction-pose.png",
        "drag-chroma.png",
        "perch-chroma.png",
        "climb-pose.png",
        "hang-pose.png",
        "fall-pose.png",
        "impact-pose.png",
    ]
    for name in needed:
        src = ASSETS / name
        if not src.exists():
            raise FileNotFoundError(src)
        shutil.copy2(src, WORK / name)

    # Prefer real single poses; only idle/sit try strip splitting.
    idle_frames = frames_from_strip_or_pose(WORK / "idle-chroma.png", 4, prefer_strip=True)

    walk_a = chroma_key(Image.open(WORK / "walk-01.png"))
    walk_b = chroma_key(Image.open(WORK / "walk-02.png"))
    walk_frames = []
    for i in range(6):
        src = walk_a if i % 2 == 0 else walk_b
        walk_frames.append(place_on_canvas(src, bob_y=int(math.sin(i * math.pi / 3) * 3)))

    sit_frames = frames_from_strip_or_pose(WORK / "sit-pose.png", 4, prefer_strip=True)
    sleep_frames = frames_from_pose(chroma_key(Image.open(WORK / "sleep-pose.png")), 4, bob=1.0)
    reaction_frames = frames_from_pose(chroma_key(Image.open(WORK / "reaction-pose.png")), 4, bob=1.5)
    # drag/perch sources may be multi-copy sheets: take strongest single subject via full-image key + canvas
    drag_frames = frames_from_pose(chroma_key(Image.open(WORK / "drag-chroma.png")), 6, bob=4.0)
    # If drag sheet still contains multiple copies, crop to the densest horizontal third
    drag_key = chroma_key(Image.open(WORK / "drag-chroma.png"))
    dw = drag_key.width
    drag_crop = drag_key.crop((dw // 3, 0, 2 * dw // 3, drag_key.height))
    try:
        subject_bbox(drag_crop)
        drag_frames = frames_from_pose(drag_crop, 6, bob=4.0)
    except ValueError:
        pass

    climb_frames = frames_from_pose(chroma_key(Image.open(WORK / "climb-pose.png")), 6, bob=5.0)
    perch_key = chroma_key(Image.open(WORK / "perch-chroma.png"))
    pw = perch_key.width
    perch_crop = perch_key.crop((pw // 4, 0, 3 * pw // 4, perch_key.height))
    try:
        subject_bbox(perch_crop)
        perch_frames = frames_from_pose(perch_crop, 4, bob=1.5)
    except ValueError:
        perch_frames = frames_from_pose(perch_key, 4, bob=1.5)
    hang_frames = frames_from_pose(chroma_key(Image.open(WORK / "hang-pose.png")), 4, bob=3.0)
    fall_frames = frames_from_pose(chroma_key(Image.open(WORK / "fall-pose.png")), 4, bob=6.0)
    impact_frames = frames_from_pose(chroma_key(Image.open(WORK / "impact-pose.png")), 4, bob=2.0)
    recover_frames = frames_from_pose(chroma_key(Image.open(WORK / "sit-pose.png")), 6, bob=2.0)
    # recover should be one seated pose, not a strip of four
    recover_key = chroma_key(Image.open(WORK / "sit-pose.png"))
    cells = split_equal_cells(recover_key, 4)
    recover_src = cells[-1]
    try:
        subject_bbox(recover_src)
        recover_frames = frames_from_pose(recover_src, 6, bob=2.0)
    except ValueError:
        pass

    preview = place_on_canvas(chroma_key(Image.open(WORK / "dog-cat-master.png")))
    preview.save(LIB / "preview.png", optimize=True)

    animations = {
        "idle": anim(save_action("idle", idle_frames), [480, 360, 320, 480], True),
        "walk": anim(save_action("walk", walk_frames), [140] * 6, True),
        "sit": anim(save_action("sit", sit_frames), [220, 240, 280, 1800], False),
        "sleep": anim(save_action("sleep", sleep_frames), [700, 700, 500, 700], True),
        "reaction": anim(save_action("reaction", reaction_frames), [180, 220, 280, 1600], False),
        "drag": anim(save_action("drag", drag_frames), [120] * 6, True),
        "climb": anim(save_action("climb", climb_frames), [140] * 6, True),
        "perch": anim(save_action("perch", perch_frames), [280, 280, 280, 1600], True),
        "hang": anim(save_action("hang", hang_frames), [220, 220, 220, 1600], True),
        "fall": anim(save_action("fall", fall_frames), [120] * 4, True),
        "impact": anim(save_action("impact", impact_frames), [140, 180, 220, 900], False),
        "recover": anim(save_action("recover", recover_frames), [160, 160, 180, 200, 260, 700], False),
    }

    manifest = {
        "schemaVersion": 1,
        "packageVersion": "0.2.0",
        "id": "dog-and-cat",
        "name": "旺财与咪咪",
        "description": "写实柴犬旺财与橘猫咪咪的双宠桌面伴侣，一起散步、趴着休息、回应你的点击。",
        "personality": ["安静陪伴", "亲近", "默契"],
        "speechGender": "female",
        "defaultSize": "small",
        "preview": "preview.png",
        "normalizationMetric": "bbox-span-v1",
        "animations": animations,
        "behavior": {
            "random": [
                {"state": "walk", "weight": 36, "minDuration": 1600, "maxDuration": 4000},
                {"state": "sit", "weight": 28, "minDuration": 4500, "maxDuration": 7000, "message": "我们就在这儿待一会儿。"},
                {
                    "state": "reaction",
                    "weight": 22,
                    "minDuration": 2400,
                    "maxDuration": 3600,
                    "message": "嗯？在叫我们吗。",
                },
                {"state": "sleep", "weight": 14, "minDuration": 5000, "maxDuration": 8000, "message": "……"},
            ],
            "perched": [
                {"state": "perch", "weight": 70, "minDuration": 3500, "maxDuration": 6500, "message": "风景还不错。"},
                {"state": "reaction", "weight": 30, "minDuration": 2200, "maxDuration": 3400, "message": "你也看到了？"},
            ],
        },
        "interactionActions": {
            "drag": {"action": "drag"},
            "climb": {"action": "climb", "anchor": {"x": 0.52, "y": 0.48}},
            "perch": {"action": "perch", "anchor": {"x": 0.5, "y": 0.55}},
            "hang": {"action": "hang", "anchor": {"x": 0.5, "y": 0.08}},
            "fall": {"action": "fall"},
            "impact": {"action": "impact"},
            "recover": {"action": "recover"},
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
    (LIB / "pet.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("library ready:", LIB)


if __name__ == "__main__":
    main()
