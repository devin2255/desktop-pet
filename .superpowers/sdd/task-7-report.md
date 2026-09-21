# Task 7 Report: 展开单人动画（brother-duo）

**Status:** DONE_WITH_CONCERNS  
**Commits:** none

## Judge copy

`pets/library/brother-judge/animations/` → `pets/library/brother-duo/animations/judge/` via robocopy `/E`（未改像素）。

Copied action dirs: climb, crawl, drag, fall, hang, idle, impact, kowtow, kowtow-crawl, mg, perch, reaction, recover, sit, sleep, slipper, walk.

Root folded duo dirs (`idle`/`walk`/`sit`/`sleep`/`reaction`/`drag`) were not overwritten.

## Floral solos

Dedicated photoreal frames at `pets/library/brother-duo/animations/floral/`:

| Action | Frames |
|---|---:|
| idle | 4 |
| walk | 6 |
| sit | 4 |
| sleep | 4 |
| reaction | 4 |
| drag | 6 |

Identity: short hair, thin glasses, red peony floral tee, army-green shorts, flip-flops, no earbuds. Processor: per-cell chroma key → pad ≥12% gutters → `process_animation_strips.py` (default 1 component). Exit 0.

Window seven (climb/perch/hang/fall/impact/recover) **not generated**. Task 8 should map floral `interactionActions` onto sit/walk/reaction/idle/drag.

## Tests

`python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v` → 7 tests OK.

## Concerns

- Floral window-edge actions are mappings, not dedicated strips.
- Sit glasses are faint on some floral sit frames.
- Sleep uses standing-pillow convention matching brother-judge, not lying down.
