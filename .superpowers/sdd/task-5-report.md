# Task 5 Report — laopo window interaction animation strips

**Status:** PASS  
**Date:** 2026-08-02  
**Branch:** feat/laopo-pet  
**Commit:** no commit (gitignored work assets under `/pets/work/`)

## Summary

Generated seven window-interaction chroma strips for **老婆 (laopo)** (34 frames), keyed them, and passed `process_animation_strips.py` into the same `processed/frames` tree as Task 4 so canvas/baseline stay unified with idle/walk/sit/sleep/reaction. Outfit locked to PRIMARY: cream maxi dress + black lace sleeves + platform sandals + sunglasses on head. Soft realistic 2D.

## Frame counts

| Action | Frames | Notes |
|---|---:|---|
| drag | 6 | Held / sideways drag bounce cycle |
| climb | 6 | Climbing invisible vertical edge (regenerated once for fragment gate) |
| perch | 4 | Seated perch; legs-hanging silhouette soft vs ideal |
| hang | 4 | Both hands up gripping invisible top edge |
| fall | 4 | Vertical fall, no squash |
| impact | 4 | Land on butt |
| pat-butt | 6 | Stand + pat dust + recover upright |

## Generated paths

### Chroma strips
```
pets/work/laopo/source/interactions/{drag,climb,perch,hang,fall,impact,pat-butt}-chroma.png
```

### Transparent (keyed)
```
pets/work/laopo/source/interactions/transparent/{drag,climb,perch,hang,fall,impact,pat-butt}.png
```

### Per-frame sources
```
pets/work/laopo/source/interactions/frames/{action}-0N.png
```
(also mirrored from GenerateImage assets under Cursor `assets/`)

### Processed frames (gate output, shared with Task 4)
```
pets/work/laopo/processed/frames/drag/01.png … 06.png
pets/work/laopo/processed/frames/climb/01.png … 06.png
pets/work/laopo/processed/frames/perch/01.png … 04.png
pets/work/laopo/processed/frames/hang/01.png … 04.png
pets/work/laopo/processed/frames/fall/01.png … 04.png
pets/work/laopo/processed/frames/impact/01.png … 04.png
pets/work/laopo/processed/frames/pat-butt/01.png … 06.png
```
Plus existing standard actions retained. Contact sheet regenerated for all 12 actions: `pets/work/laopo/processed/contact-sheet.jpg`.

## Method

1. **GenerateImage** per-frame full-body on `#00ff00` with `ref-fullbody.png` + `ref-portrait.png` + `master-chroma.png`.
2. Compose wide strips with ≥14% green gutters via `pets/work/laopo/_compose_interactions.py` (512×768 cells).
3. Chroma key via `pets/work/laopo/chroma_key.py` → `source/interactions/transparent/`.
4. Process into shared `processed/frames` with `process_animation_strips.py`.
5. **Did not erase spill fragments** to pass gates; regenerated climb strip when fragment gate failed.
6. Avoided `remove_platforms` on cream-dress subjects after it punched fabric holes; recomposed drag/fall/impact/pat-butt/perch/hang without platform wipe.

## Regenerations

| Strip | Attempts | Outcome |
|---|---|---|
| drag | 1 (+ recompose w/o platform wipe) | Pass |
| climb | v1 FAIL frame6 fragment → full 6-frame regen (cleaner, no window bars) | Pass |
| perch | v1 floor-sit → v2 edge-sit prompts; recompose w/o platform wipe | Pass (pose soft) |
| hang | 1 (+ recompose w/o platform wipe) | Pass |
| fall | 1 (+ recompose w/o platform wipe) | Pass |
| impact | 1 (+ recompose w/o platform wipe) | Pass |
| pat-butt | 1 (+ recompose w/o platform wipe) | Pass |

## process_animation_strips

Command (interactions only):

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/laopo/source/interactions/transparent `
  --output-dir pets/work/laopo/processed/frames `
  --action drag:6 `
  --action climb:6 `
  --action perch:4 `
  --action hang:4 `
  --action fall:4 `
  --action impact:4 `
  --action "pat-butt:6"
```

`--action pat-butt:6` works when quoted on PowerShell (`"pat-butt:6"`).

Final combined re-run (standards + interactions) also exit `0`. Log: `pets/work/laopo/processed/process_interactions_log.txt`.

## Gate result

**PASS** — all seven interaction actions processed (34 frames) into shared output dir; standards retained; combined contact sheet written.

## Concerns

1. **perch** still reads closer to “sitting with knees up” than ideal “butt on invisible top edge + legs fully dangling”; usable for packaging but soft vs brief.
2. Model often paints white window bars on climb/perch/hang; cream-dress `remove_platforms` destroys fabric — prefer clean regenerations over platform wipe.
3. Work assets under `pets/work/` remain **gitignored**.
4. Inter-frame motion continuity is illustration-approximate (not a perfect physics loop).

## Next

Task 6+ can add perch idle specials (`perch-hair-flip`, etc.) into the same `--output-dir`.

---

## Pose fix (2026-08-02 late) — Critical perch / hang

**Status:** PASS  
**Scope:** Only `perch` (4) + `hang` (4). Other actions untouched (mtime unchanged).

### Problem
- Prior `perch` read as ground-sit with tucked legs.
- Prior `hang` read as standing with arms raised.

### What changed
1. Regenerated full-body `#00ff00` frames via GenerateImage + `ref-fullbody` / `ref-portrait` (+ prior good hang pose refs).
2. **perch:** butt on invisible top edge, both legs dangling down, dress hanging over edge; hands on lap/edge. Replaced weak `perch-03`.
3. **hang:** suspended under invisible top edge, both hands gripping above head, legs dangling (rejected standing / barefoot / tucked-knee / painted-bar attempts; kept clean identity frames).
4. Recomposed via `pets/work/laopo/_compose_interactions.py perch hang` (≥14% gutters) → chroma + `transparent/{perch,hang}.png`.
5. Reprocessed:

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/laopo/source/interactions/transparent `
  --output-dir pets/work/laopo/processed/frames `
  --action perch:4 --action hang:4
```

Exit code `0`. Overwrote `processed/frames/perch|hang/01-04.png` only.

### Gate result
**PASS** — `process_animation_strips.py` exit 0 for perch:4 + hang:4. Other interaction/standard frames preserved.

### Concerns
1. Shared foot-baseline normalization collapses empty space under feet, so isolated processed hang frames can still look “planted” vs chroma strip (pose silhouette + raised arms remain the hang cue).
2. Model sometimes paints a visible grip bar — rejected those frames; prefer invisible edge.
3. Hang/perch inter-frame sway is illustration-approximate.
