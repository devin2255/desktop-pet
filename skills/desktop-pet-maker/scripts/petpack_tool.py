from __future__ import annotations

import argparse
import json
import math
import re
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image


REQUIRED_ACTIONS = {"idle": 4, "walk": 6, "sit": 4, "sleep": 4, "reaction": 4}
INTERACTION_ROLES = {"drag", "climb", "perch", "hang", "fall", "impact", "recover"}
MAX_ARCHIVE_ENTRIES = 300
MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024
MAX_MANIFEST_BYTES = 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_IMAGE_PIXELS = 16 * 1024 * 1024


def safe_relative(value: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ValueError(f"unsafe relative path: {value}")
    pure = PurePosixPath(value)
    if pure.is_absolute() or not pure.parts:
        raise ValueError(f"unsafe relative path: {value}")
    for part in pure.parts:
        if part in {"", ".", ".."} or re.search(r'[:<>"|?*\x00-\x1f]', part) or part.endswith((".", " ")):
            raise ValueError(f"unsafe relative path: {value}")
    return Path(*pure.parts)


def referenced_files(manifest: dict) -> set[str]:
    referenced = {"pet.json", safe_relative(str(manifest.get("preview", ""))).as_posix()}
    for config in manifest.get("animations", {}).values():
        if isinstance(config, dict):
            for frame in config.get("frames", []):
                referenced.add(safe_relative(str(frame)).as_posix())
    return referenced


def validate_manifest_shape(manifest: dict) -> list[str]:
    if manifest.get("schemaVersion") != 1:
        raise ValueError("schemaVersion must be 1")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", str(manifest.get("id", ""))):
        raise ValueError("invalid pet id")
    name = manifest.get("name")
    if not isinstance(name, str) or not name.strip() or len(name) > 80:
        raise ValueError("name must contain 1 to 80 characters")
    description = manifest.get("description")
    if description is not None and (not isinstance(description, str) or len(description) > 500):
        raise ValueError("description must not exceed 500 characters")
    personality = manifest.get("personality")
    if personality is not None and (
        not isinstance(personality, list)
        or len(personality) > 12
        or any(not isinstance(item, str) or not item.strip() or len(item) > 32 for item in personality)
    ):
        raise ValueError("personality must contain at most 12 non-empty short strings")

    preview = safe_relative(str(manifest.get("preview", "")))
    if preview.suffix.lower() != ".png":
        raise ValueError("preview must be a PNG")
    animations = manifest.get("animations")
    if not isinstance(animations, dict):
        raise ValueError("animations must be an object")

    frame_paths: list[str] = []
    for action, expected in REQUIRED_ACTIONS.items():
        config = animations.get(action)
        if not isinstance(config, dict):
            raise ValueError(f"missing animation: {action}")
        frames = config.get("frames")
        durations = config.get("durations")
        if not isinstance(frames, list) or len(frames) != expected:
            raise ValueError(f"{action}: expected {expected} frame paths")
        if not isinstance(durations, list) or len(durations) != len(frames):
            raise ValueError(f"{action}: durations must match frames")
        if any(not isinstance(value, int) or isinstance(value, bool) or not 40 <= value <= 10000 for value in durations):
            raise ValueError(f"{action}: duration must be an integer from 40 to 10000 ms")
        scale = config.get("scale", 1)
        if not isinstance(scale, (int, float)) or isinstance(scale, bool) or not 0.5 <= scale <= 1.5:
            raise ValueError(f"{action}: scale must be a number from 0.5 to 1.5")
        canonical_frames: set[str] = set()
        for frame_path in frames:
            relative = safe_relative(str(frame_path))
            if relative.suffix.lower() != ".png":
                raise ValueError(f"{action}: frames must be PNG files")
            canonical = relative.as_posix().casefold()
            if canonical in canonical_frames:
                raise ValueError(f"{action}: duplicate frame path")
            canonical_frames.add(canonical)
            frame_paths.append(relative.as_posix())

    interaction_actions = manifest.get("interactionActions")
    if interaction_actions is not None:
        if not isinstance(interaction_actions, dict):
            raise ValueError("interactionActions must be an object")
        for role, config in interaction_actions.items():
            if role not in INTERACTION_ROLES or not isinstance(config, dict):
                raise ValueError("interactionActions contains an unsupported role")
            action = config.get("action")
            if not isinstance(action, str) or action not in animations:
                raise ValueError("interactionActions references an unknown animation")
            anchor = config.get("anchor")
            if anchor is not None:
                if not isinstance(anchor, dict):
                    raise ValueError("interactionActions anchor must be an object")
                x, y = anchor.get("x"), anchor.get("y")
                if (
                    not isinstance(x, (int, float))
                    or isinstance(x, bool)
                    or not math.isfinite(x)
                    or not isinstance(y, (int, float))
                    or isinstance(y, bool)
                    or not math.isfinite(y)
                    or not 0 <= x <= 1
                    or not 0 <= y <= 1
                ):
                    raise ValueError("interactionActions anchor must be within 0..1")

    behavior = manifest.get("behavior", {}).get("random") if isinstance(manifest.get("behavior", {}), dict) else None
    if behavior is not None:
        if not isinstance(behavior, list) or not 1 <= len(behavior) <= 20:
            raise ValueError("behavior.random must contain 1 to 20 entries")
        for item in behavior:
            if not isinstance(item, dict) or item.get("state") not in animations:
                raise ValueError("behavior.random references an unknown animation")
            weight = item.get("weight")
            minimum = item.get("minDuration")
            maximum = item.get("maxDuration")
            if not isinstance(weight, (int, float)) or isinstance(weight, bool) or not 0 < weight <= 10000:
                raise ValueError("behavior.random weight is invalid")
            if (
                not isinstance(minimum, (int, float))
                or isinstance(minimum, bool)
                or not isinstance(maximum, (int, float))
                or isinstance(maximum, bool)
                or minimum < 600
                or maximum > 60000
                or maximum < minimum
            ):
                raise ValueError("behavior.random duration is invalid")
    return frame_paths


def validate_png(path: Path, relative_value: str) -> tuple[tuple[int, int], int, int]:
    if path.stat().st_size > MAX_SINGLE_FILE_BYTES:
        raise ValueError(f"PNG exceeds 50MB: {relative_value}")
    with Image.open(path) as source:
        if source.format != "PNG":
            raise ValueError(f"not a PNG: {relative_value}")
        width, height = source.size
        if width <= 0 or height <= 0 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION or width * height > MAX_IMAGE_PIXELS:
            raise ValueError(f"PNG dimensions exceed limits: {relative_value}")
        if "A" not in source.getbands() and "transparency" not in source.info:
            raise ValueError(f"PNG has no alpha channel: {relative_value}")
        image = source.convert("RGBA")

    alpha = image.getchannel("A")
    box = alpha.getbbox()
    if box is None:
        raise ValueError(f"empty PNG: {relative_value}")
    if image.getpixel((0, 0))[3] > 8:
        raise ValueError(f"PNG corner is not transparent: {relative_value}")
    pixels = image.load()
    green = 0
    visible = 0
    for y in range(image.height):
        for x in range(image.width):
            red, channel_green, blue, opacity = pixels[x, y]
            if opacity > 25:
                visible += 1
                if channel_green > 190 and channel_green > red * 1.7 and channel_green > blue * 1.7:
                    green += 1
    if visible and green / visible > 0.005:
        raise ValueError(f"green-screen residue exceeds 0.5%: {relative_value}")
    alpha_values = alpha.get_flattened_data() if hasattr(alpha, "get_flattened_data") else alpha.getdata()
    subject_area = sum(1 for value in alpha_values if value > 24)
    subject_span = max(box[2] - box[0], box[3] - box[1])
    return image.size, subject_area, subject_span


def validate_directory(root: Path) -> dict:
    manifest_path = root / "pet.json"
    if not manifest_path.is_file():
        raise ValueError("pet.json is missing")
    if manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
        raise ValueError("pet.json exceeds 1MB")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    frame_paths = validate_manifest_shape(manifest)
    referenced = referenced_files(manifest)
    actual_files = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
    extras = sorted(actual_files - referenced)
    missing = sorted(referenced - actual_files)
    if extras:
        raise ValueError(f"unreferenced package file: {extras[0]}")
    if missing:
        raise ValueError(f"missing referenced file: {missing[0]}")

    canvas_sizes: set[tuple[int, int]] = set()
    subject_spans: list[int] = []
    subject_areas: list[int] = []
    for relative_value in sorted(referenced - {"pet.json"}):
        path = root / safe_relative(relative_value)
        canvas_size, subject_area, subject_span = validate_png(path, relative_value)
        if relative_value in frame_paths:
            canvas_sizes.add(canvas_size)
            subject_areas.append(subject_area)
            subject_spans.append(subject_span)
    if len(canvas_sizes) != 1:
        raise ValueError(f"animation frames must share one canvas size: {sorted(canvas_sizes)}")

    normalization_metric = manifest.get("normalizationMetric", "bbox-span-v1")
    values = subject_areas if normalization_metric == "alpha-area-v1" else subject_spans
    unit = "alpha pixels" if normalization_metric == "alpha-area-v1" else "pixels"
    if normalization_metric not in {"alpha-area-v1", "bbox-span-v1"}:
        raise ValueError(f"unsupported normalizationMetric: {normalization_metric}")
    smallest = min(values)
    largest = max(values)
    if smallest <= 0 or largest / smallest > 1.08:
        raise ValueError(f"visible subject scale drifts across frames: {smallest}..{largest} {unit}")
    return manifest


def validate_archive_entries(package: zipfile.ZipFile) -> None:
    infos = package.infolist()
    if not 1 <= len(infos) <= MAX_ARCHIVE_ENTRIES:
        raise ValueError("archive must contain 1 to 300 entries")
    canonical_names: set[str] = set()
    total = 0
    for info in infos:
        name = info.filename[:-1] if info.is_dir() and info.filename.endswith("/") else info.filename
        safe_relative(name)
        canonical = name.casefold()
        if canonical in canonical_names:
            raise ValueError(f"duplicate or case-colliding archive path: {name}")
        canonical_names.add(canonical)
        if info.flag_bits & 0x1:
            raise ValueError(f"encrypted archive entry is not allowed: {name}")
        mode = (info.external_attr >> 16) & 0o170000
        if mode and stat.S_ISLNK(mode):
            raise ValueError(f"symbolic link is not allowed: {name}")
        if info.file_size < 0 or info.file_size > MAX_SINGLE_FILE_BYTES:
            raise ValueError(f"archive entry exceeds 50MB: {name}")
        total += info.file_size
        if total > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("archive expands beyond 200MB")


def validate_archive(archive: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix="petpack-validate-") as temp:
        root = Path(temp)
        with zipfile.ZipFile(archive) as package:
            validate_archive_entries(package)
            package.extractall(root)
        return validate_directory(root)


def build_package(source: Path, output: Path) -> None:
    validate_directory(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for path in sorted(source.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(source).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package.writestr(info, path.read_bytes(), compresslevel=9)
    validate_archive(output)
    print(output)


def extract_package(archive: Path, output: Path) -> None:
    validate_archive(archive)
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"output directory is not empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as package:
        validate_archive_entries(package)
        package.extractall(output)
    validate_directory(output)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate")
    validate.add_argument("path", type=Path)
    build = subparsers.add_parser("build")
    build.add_argument("source", type=Path)
    build.add_argument("output", type=Path)
    extract = subparsers.add_parser("extract")
    extract.add_argument("archive", type=Path)
    extract.add_argument("output", type=Path)
    args = parser.parse_args()

    if args.command == "validate":
        manifest = validate_directory(args.path) if args.path.is_dir() else validate_archive(args.path)
        print(f"valid: {manifest['id']} ({manifest['name']})")
    elif args.command == "build":
        build_package(args.source, args.output)
    else:
        extract_package(args.archive, args.output)


if __name__ == "__main__":
    main()
