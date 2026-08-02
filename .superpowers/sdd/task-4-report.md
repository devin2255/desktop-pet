# Task 4 Report — laopo master + five standard chroma strips

**Status:** PASS  
**Date:** 2026-08-01  
**Branch:** feat/laopo-pet  
**Commit:** no commit (gitignored work assets under `/pets/work/`)

## Summary

Generated master + five standard action chroma strips for **老婆 (laopo)**, chroma-keyed them, and passed `process_animation_strips.py` gates for idle/walk/sit/sleep/reaction (22 frames). Outfit locked to PRIMARY: cream maxi dress + black lace sleeves + platform sandals + sunglasses on head. idle = upright standing; walk = upright stroll facing RIGHT.

## Generated paths

### Master & chroma strips
| File | Notes |
|---|---|
| `pets/work/laopo/source/standard/master-chroma.png` | Standing master on `#00ff00` |
| `pets/work/laopo/source/standard/idle-chroma.png` | 4 cells, composed 2048×768 |
| `pets/work/laopo/source/standard/walk-chroma.png` | 6 cells, composed 3072×768 |
| `pets/work/laopo/source/standard/sit-chroma.png` | 4 cells, composed 2048×768 |
| `pets/work/laopo/source/standard/sleep-chroma.png` | 4 cells, native strip 1536×1024 |
| `pets/work/laopo/source/standard/reaction-chroma.png` | 4 cells, composed 2048×768 |

### Transparent (keyed)
| File |
|---|
| `pets/work/laopo/source/standard/transparent/master.png` |
| `pets/work/laopo/source/standard/transparent/idle.png` |
| `pets/work/laopo/source/standard/transparent/walk.png` |
| `pets/work/laopo/source/standard/transparent/sit.png` |
| `pets/work/laopo/source/standard/transparent/sleep.png` |
| `pets/work/laopo/source/standard/transparent/reaction.png` |

### Per-frame sources (used after strip regenerations)
`pets/work/laopo/source/standard/frames/{idle,walk,sit,reaction}-0N.png`

### Processed frames (gate output)
```
pets/work/laopo/processed/frames/idle/01.png … 04.png
pets/work/laopo/processed/frames/walk/01.png … 06.png
pets/work/laopo/processed/frames/sit/01.png … 04.png
pets/work/laopo/processed/frames/sleep/01.png … 04.png
pets/work/laopo/processed/frames/reaction/01.png … 04.png
pets/work/laopo/processed/contact-sheet.jpg
```

## Method

1. **GenerateImage** with `ref-fullbody.png` + `ref-portrait.png` (+ master) for identity.
2. First-pass native horizontal strips failed cell-safety on idle/walk/sit/reaction (1536×1024 equal split → bleed at boundaries; walk cells only 256px wide).
3. Regenerated **idle / walk / sit / reaction** as individual full-body chroma frames, then composed into wide strips with ≥14% left/right green gutters per cell (`pets/work/laopo/_compose_strips.py` + `chroma_key.py`). **Did not erase spill fragments.**
4. **sleep** first-pass strip already passed gutters; kept.
5. Chroma key via `pets/work/laopo/chroma_key.py` (`imagegen` CLI unavailable). Sit frames used `--remove-platforms` when extracting subjects.

## Regenerations

| Strip | Attempts | Outcome |
|---|---|---|
| master | 1 | Kept |
| idle | strip v1 FAIL → strip v2 FAIL → 4 individual frames + compose | Pass |
| walk | strip v1 FAIL → 6 individual frames (walk-02 re-gen for RIGHT facing) + compose | Pass |
| sit | strip v1 FAIL → 4 individual frames + compose | Pass |
| sleep | 1 | Kept (no regen) |
| reaction | strip v1 FAIL → 4 individual frames + compose | Pass |

## process_animation_strips

Command:

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/laopo/source/standard/transparent `
  --output-dir pets/work/laopo/processed/frames `
  --action idle:4 `
  --action walk:6 `
  --action sit:4 `
  --action sleep:4 `
  --action reaction:4
```

**Final run:** exit code `0`  
**stdout/stderr:** empty (success; no ValueError)  
Log copy: `pets/work/laopo/processed/process_strips_log.txt` (empty file, exit 0)

Earlier failures (before regen/compose), for the record:

```
ValueError: idle frame 4 enters the safety gutter (left/right/top/bottom=(6, 127, 75, 31), required=15/20). ...
ValueError: idle frame 1 enters the safety gutter (left/right/top/bottom=(256, 0, 267, 229), required=15/20). ...
```

## Gate result

**PASS** — all five actions processed; 22 normalized frames + contact sheet written.

## Concerns

1. Work assets under `pets/work/` are **gitignored** — nothing from this task is trackable without force-add; private refs must not be force-added.
2. Sleep pose is a seated/curled sleep (head on hands), not fully reclined — acceptable for dress silhouette but slightly soft vs “lying asleep” prompt.
3. Walk cycle is upright facing right, but inter-frame leg phase continuity is illustration-approximate (not a perfect classical contact/down/passing loop).
4. Style is soft 2D illustration matching IDENTITY; slight face softening vs photo refs is expected for sprite treatment.

## Next

Task 5–6 can append more `--action name:count` into the same `--output-dir`.
