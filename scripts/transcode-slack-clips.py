#!/usr/bin/env python3
"""Re-encode slack clips for Chromium: baseline H.264, no audio, modest bitrate."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "pets" / "library" / "brother-duo" / "video" / "slack"
BACKUP = ROOT / "tmp" / "slack-source-videos"
OUT = ROOT / "tmp" / "slack-transcode"
CLIPS = ("feishu-20260803.mp4", "feishu-20260915.mp4", "sweet-outfit-720p.mp4")


def run(cmd: list[str]) -> None:
    print(" ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def main() -> int:
    BACKUP.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for name in CLIPS:
        src = SRC / name
        if not src.exists():
            raise SystemExit(f"missing {src}")
        bak = BACKUP / name
        if not bak.exists():
            shutil.copy2(src, bak)
        dest = OUT / name
        vf = "scale='if(gt(iw,960),960,iw)':-2,format=yuv420p"
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(bak),
                "-an",
                "-c:v",
                "libx264",
                "-profile:v",
                "baseline",
                "-level",
                "3.1",
                "-preset",
                "fast",
                "-b:v",
                "1200k",
                "-maxrate",
                "1500k",
                "-bufsize",
                "3000k",
                "-g",
                "48",
                "-vf",
                vf,
                "-movflags",
                "+faststart",
                str(dest),
            ]
        )
        shutil.copy2(dest, src)
        print(f"{name}: {bak.stat().st_size} -> {src.stat().st_size}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
