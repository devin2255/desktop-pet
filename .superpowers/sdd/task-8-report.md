# Task 8 Report — assemble pets/library/laopo + pet.json

**Status:** PASS  
**Date:** 2026-08-02  
**Commit:** no commit (`/pets/library/` is gitignored; boss library also untracked — only `pets/packages/boss.petpack` is published)

## Summary

Assembled **老婆 (laopo)** library package at `pets/library/laopo/` with all 22 animations, 6 audio clips, `preview.png`, and brief-exact `pet.json`. `petpack_tool.py validate` **PASS**.

## Steps completed

1. **Copied frames** from `pets/work/laopo/processed/frames/<action>/` → `pets/library/laopo/animations/<action>/01.png…`  
   Frame counts matched brief (no BLOCKED): idle4, walk6, sit4, sleep4, reaction4, drag6, climb6, perch4, perch-*6, hang4, fall4, impact4, pat-butt6, call-hubby6, kowtow6, talent-show8, serve-tea6, love-you/praise/encourage4.
2. **Audio** already staged: `audio/{call-hubby,encourage,love-you,praise,serve-tea,talent-show}.mp3`.
3. **Wrote** `pet.json` UTF-8 no BOM from task-8 brief (ids/messages/weights/speechAudio unchanged).
4. **preview.png** from `idle/01.png`.
5. **Validate** initially **FAILED** on alpha-area drift `23707..38781` (ratio ~1.64 > 1.08).  
   Cause: upstream `process_animation_strips` fit_scale capped tall poses (esp. `hang/04`) below `TARGET_ALPHA_AREA=38000` while other actions sat near ~38k.  
   Fix: re-normalized all library frames to a common achievable target (~23233 alpha px, limited by hang/04), then synced back to `pets/work/laopo/processed/frames/`. Preview refreshed.
6. Re-validate: **PASS** — `valid: laopo (老婆)`; post-renorm area ratio ~1.013.

## Validate

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/laopo
# valid: laopo (老婆)
```

## Package layout

```
pets/library/laopo/
  pet.json
  preview.png
  audio/*.mp3  (6)
  animations/<22 actions>/*.png
```

## Commit

- **No commit.** `.gitignore` line 37: `/pets/library/` ignores the tree (`git check-ignore` confirms).
- `pets/packages/laopo.petpack` **not yet built** (Task 9+).

## Concerns

1. Global downscale to ~23k alpha px (hang-limited) makes the pet visually smaller than the 38k pipeline target / boss (~25k). Better fix: regenerate compact `hang` (and other tall outliers) so reprocess can hit ~38k without dragging every action down.
2. Foot-baseline compositing for `hang`/`perch` remains a pose/placement compromise from the shared strip processor.
3. Library + work assets stay local/gitignored; only a future `.petpack` under `pets/packages/` would be the publishable tracked artifact (per boss convention).
