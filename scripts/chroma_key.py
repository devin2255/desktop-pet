#!/usr/bin/env python3
"""Chroma-key helper aligned with desktop-pet-maker defaults (no external imagegen CLI)."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image
import numpy as np


def chroma_key(
    image: Image.Image,
    *,
    transparent_threshold: int = 12,
    opaque_threshold: int = 220,
    despill: bool = True,
) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]

    # Border-style green dominance
    green_dom = (g > 90) & (g > r * 1.35) & (g > b * 1.35)
    very_green = (g > 160) & (r < 120) & (b < 120)
    score = (g - np.maximum(r, b)) / 255.0

    alpha = a.copy()
    kill = green_dom & ((score > 0.28) | very_green)
    soft = green_dom & ~kill
    alpha[kill] = 0
    alpha[soft] = np.clip(255 * (1.0 - score[soft] * 2.4), 0, 255)

    # Soft matte thresholds
    alpha = np.where(alpha < transparent_threshold, 0, alpha)
    alpha = np.where(alpha > opaque_threshold, 255, alpha)

    out_r, out_g, out_b = r.copy(), g.copy(), b.copy()
    if despill:
        fringe = (alpha > 0) & (g > r + 18) & (g > b + 18)
        out_g = np.where(fringe, np.minimum(g, (r + b) * 0.5 + 8), out_g)
        # Pull green fringe toward subject luminance
        out_r = np.where(soft, np.minimum(255, r + (np.maximum(r, b) - g) * 0.35), out_r)
        out_b = np.where(soft, np.minimum(255, b + (np.maximum(r, b) - g) * 0.35), out_b)
        out_g = np.where(soft, np.minimum(out_r, out_b), out_g)

    out = np.stack([out_r, out_g, out_b, alpha], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--transparent-threshold", type=int, default=12)
    parser.add_argument("--opaque-threshold", type=int, default=220)
    parser.add_argument("--despill", action="store_true", default=True)
    parser.add_argument("--no-despill", action="store_true")
    args = parser.parse_args()
    despill = not args.no_despill
    result = chroma_key(
        Image.open(args.input),
        transparent_threshold=args.transparent_threshold,
        opaque_threshold=args.opaque_threshold,
        despill=despill,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, optimize=True)
    print(args.output)


if __name__ == "__main__":
    main()
