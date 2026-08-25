#!/usr/bin/env python3
"""Scan brother-judge library frames for matting / clipping issues."""
from __future__ import annotations

import collections
import json
from pathlib import Path

from PIL import Image

ROOT = Path("pets/library/brother-judge/animations")
ALPHA = 24
OUT = Path("outputs/brother-judge-matting-audit.json")


def components(mask: Image.Image) -> list[tuple[int, int, int, int, int]]:
    w, h = mask.size
    data = list(mask.getdata())
    visited = [False] * (w * h)
    areas: list[tuple[int, int, int, int, int]] = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if visited[i] or data[i] == 0:
                continue
            stack = [(x, y)]
            visited[i] = True
            area = 0
            minx = maxx = x
            miny = maxy = y
            while stack:
                cx, cy = stack.pop()
                area += 1
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not visited[j] and data[j]:
                            visited[j] = True
                            stack.append((nx, ny))
            areas.append((area, minx, miny, maxx, maxy))
    areas.sort(reverse=True)
    return areas


def main() -> None:
    issues = []
    summary = []
    for action_dir in sorted(ROOT.iterdir()):
        if not action_dir.is_dir():
            continue
        action = action_dir.name
        for fp in sorted(action_dir.glob("*.png")):
            im = Image.open(fp).convert("RGBA")
            mask = im.getchannel("A").point(lambda v: 255 if v > ALPHA else 0)
            bbox = mask.getbbox()
            comps = components(mask)
            total = sum(c[0] for c in comps) or 1
            significant = [c for c in comps if c[0] >= max(80, int(total * 0.02))]
            touches = []
            if bbox:
                if bbox[0] <= 1:
                    touches.append("L")
                if bbox[1] <= 1:
                    touches.append("T")
                if bbox[2] >= im.size[0] - 2:
                    touches.append("R")
                if bbox[3] >= im.size[1] - 2:
                    touches.append("B")
            detached = False
            if len(significant) >= 2:
                main = significant[0]
                for sec in significant[1:]:
                    mx0, my0, mx1, my1 = main[1:]
                    sx0, sy0, sx1, sy1 = sec[1:]
                    gap_x = sx0 > mx1 + 8 or mx0 > sx1 + 8
                    gap_y = sy0 > my1 + 8 or my0 > sy1 + 8
                    if gap_x or gap_y:
                        detached = True
            flags = []
            if detached:
                flags.append(f"detached_parts({len(significant)}comp)")
            side = set(touches) - {"B"}
            if side:
                flags.append("edge_touch:" + ",".join(sorted(side)))
            fragments = [c for c in comps if 20 <= c[0] < max(80, int(total * 0.02))]
            if fragments:
                flags.append(f"fragments({len(fragments)})")
            # large vertical hole inside bbox: sample empty rows in middle third
            hole = False
            if bbox and significant:
                x0, y0, x1, y1 = bbox
                mid_y0 = y0 + (y1 - y0) // 3
                mid_y1 = y0 + 2 * (y1 - y0) // 3
                empty_rows = 0
                for y in range(mid_y0, mid_y1):
                    row_has = False
                    for x in range(x0, x1 + 1):
                        if mask.getpixel((x, y)):
                            row_has = True
                            break
                    if not row_has:
                        empty_rows += 1
                if empty_rows >= 8:
                    hole = True
                    flags.append(f"mid_gap_rows({empty_rows})")
            row = {
                "action": action,
                "frame": fp.name,
                "path": str(fp).replace("\\", "/"),
                "size": list(im.size),
                "bbox": list(bbox) if bbox else None,
                "comps": len(comps),
                "sig": len(significant),
                "alpha": total,
                "flags": flags,
            }
            summary.append(row)
            if flags:
                issues.append(row)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"issues": issues, "summary": summary}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== ISSUES ===")
    for r in issues:
        print(
            f"{r['action']}/{r['frame']}: {', '.join(r['flags'])} "
            f"bbox={r['bbox']} alpha={r['alpha']} sig={r['sig']}"
        )
    print(f"\nissue_frames={len(issues)} / total={len(summary)}")
    print("\n=== BY ACTION ===")
    by = collections.defaultdict(list)
    for r in issues:
        by[r["action"]].append(r["frame"] + ":" + "|".join(r["flags"]))
    for a, items in sorted(by.items()):
        print(a, len(items), ";", "; ".join(items))
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
