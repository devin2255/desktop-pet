# Task 6 Report — laopo perched / menu / roaming custom actions

**Status:** PASS  
**Date:** 2026-08-02  
**Branch:** feat/laopo-pet  
**Commit:** no commit (gitignored work assets under `/pets/work/`)

## Summary

Generated ten custom-action chroma strips for **老婆 (laopo)** (56 frames), keyed them, and passed `process_animation_strips.py` into the same `processed/frames` tree as Tasks 4–5. Outfit locked to PRIMARY: cream maxi dress + black lace sleeves + platform sandals + sunglasses on head. Soft realistic 2D. Banned actions `perch-cross-phone`, `call-dad`, `self-slap` are absent from processed frames.

## Frame counts

| Action | Frames | Notes |
|---|---:|---|
| perch-hair-flip | 6 | Perch seat + hair flip/stroke |
| perch-blow-kiss | 6 | Perch seat + air-kiss send (some prompts softened for safety) |
| perch-look | 6 | Perch seat, look left → center → right |
| call-hubby | 6 | Standing wave / call-out |
| kowtow | 6 | Female kneel → deep bow → rise |
| talent-show | 8 | Upright butt-shake dance loop feel |
| serve-tea | 6 | Offer teacup forward politely |
| love-you | 4 | Heart-hands |
| praise | 4 | Thumbs-up / clap |
| encourage | 4 | Gentle cheer / supportive fists |

## Generated paths

### Chroma strips
```
pets/work/laopo/source/interactions/{perch-hair-flip,perch-blow-kiss,perch-look,call-hubby,kowtow,talent-show,serve-tea,love-you,praise,encourage}-chroma.png
```

### Transparent (keyed)
```
pets/work/laopo/source/interactions/transparent/{same}.png
```

### Per-frame sources
```
pets/work/laopo/source/interactions/frames/{action}-0N.png
```
(also under Cursor `assets/`)

### Processed frames (gate output, shared with Tasks 4–5)
```
pets/work/laopo/processed/frames/perch-hair-flip/01.png … 06.png
pets/work/laopo/processed/frames/perch-blow-kiss/01.png … 06.png
pets/work/laopo/processed/frames/perch-look/01.png … 06.png
pets/work/laopo/processed/frames/call-hubby/01.png … 06.png
pets/work/laopo/processed/frames/kowtow/01.png … 06.png
pets/work/laopo/processed/frames/talent-show/01.png … 08.png
pets/work/laopo/processed/frames/serve-tea/01.png … 06.png
pets/work/laopo/processed/frames/love-you/01.png … 04.png
pets/work/laopo/processed/frames/praise/01.png … 04.png
pets/work/laopo/processed/frames/encourage/01.png … 04.png
```

Contact sheet (all 22 actions): `pets/work/laopo/processed/contact-sheet.jpg`

## Method

1. **GenerateImage** per-frame full-body on `#00ff00` with `ref-fullbody.png` + `ref-portrait.png` + Task 5 `perch-01` / `idle-01` refs.
2. Compose wide strips with ≥14% green gutters via updated `pets/work/laopo/_compose_interactions.py` (512×768 cells; perch-* use upper-third placement).
3. Chroma key via `chroma_key.py` → `source/interactions/transparent/` (no `remove_platforms`).
4. Process into shared `processed/frames` with `process_animation_strips.py`.
5. **Did not erase spill fragments** to pass gates; regenerated weak frames instead.
6. Combined re-run of standards + interactions + Task 6 into `_combined_transparent` also exit `0`.

## Regenerations / blocks

| Item | Attempts | Outcome |
|---|---|---|
| perch-blow-kiss 02/05/06 | safety block on “kiss” wording → softer “air-kiss” prompts | Pass |
| perch-hair-flip 04/06 | 2–3 pose regens for dangling-leg perch | Pass gate; pose still soft (knees sometimes tucked) |
| praise-02 | regen to restore sunglasses-on-head | Pass |

Boss-era asset strips (`kowtow-chroma.png` etc. under Cursor assets) were **not** used — wrong identity.

## process_animation_strips

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/laopo/source/interactions/transparent `
  --output-dir pets/work/laopo/processed/frames `
  --action "perch-hair-flip:6" `
  --action "perch-blow-kiss:6" `
  --action "perch-look:6" `
  --action "call-hubby:6" `
  --action kowtow:6 `
  --action "talent-show:8" `
  --action "serve-tea:6" `
  --action "love-you:4" `
  --action praise:4 `
  --action encourage:4
```

**Final Task-6-only run:** exit code `0`  
**Combined all-actions run:** exit code `0`  
Logs: `pets/work/laopo/processed/process_task6_log.txt`, `process_task6_combined_log.txt`

## Gate result

**PASS** — all ten custom actions (56 frames) processed into shared output dir; prior Task 4/5 frames retained; banned actions absent; combined contact sheet written.

## Concerns

1. Several **perch-*** frames still read closer to knees-tucked sit than ideal “butt on invisible top edge + legs fully dangling” (same soft issue as Task 5 perch). Usable for packaging.
2. Blow-kiss wording hit content safety; gestures remain readable as affectionate air-kiss sequence.
3. Inter-frame dance/wave continuity is illustration-approximate.
4. Work assets under `pets/work/` remain **gitignored**.

## Next

Task 7+ can wire `pet.json` behaviors/menus/audio (`call-hubby`, `talent-show`, `serve-tea`, perched weights) and package `.petpack` / customer EXE.
