# Task 3 Report: 素材目录与制作 Prompt

**Status:** DONE  
**Branch:** `feat/laopo-pet`  
**Commit:** `c13cb94` — docs: add laopo pet creation prompt

## Summary

Copied user reference photos to local workspace, wrote stable identity doc and laopo creation prompt mirroring boss structure with approved spec requirements.

## Files Created

| File | Status |
|------|--------|
| `pets/work/laopo/source/refs/ref-fullbody.png` | Created (222,058 bytes) — local only |
| `pets/work/laopo/source/refs/ref-portrait.png` | Created (100,301 bytes) — local only |
| `pets/work/laopo/IDENTITY.md` | Created — local only |
| `docs/prompts/make-laopo-pet.txt` | Created — committed |

## Ref Verification

Both refs copied from Cursor assets, readable, same person confirmed:

- **ref-fullbody.png:** Outdoor park full-body; cream sleeveless maxi dress, black lace short-sleeve layer, chunky black platform sandals, sunglasses on head, arms outstretched.
- **ref-portrait.png:** Indoor close-up; long straight black hair, glasses on head, playful sweet expression, beige ribbed top (face/hair/accessory anchor).

## IDENTITY.md Contents

Covers: young East Asian woman; long straight black hair; black sunglasses/glasses on head; cream sleeveless maxi dress; black lace short-sleeve layer; chunky black platform sandals; playful sweet expression; soft realistic 2D illustration style; full body visible in animations.

## make-laopo-pet.txt Highlights

Mirrors `make-boss-pet.txt` structure with laopo spec:

- Upright idle/walk (no crawling)
- Female speech (`speechGender: female`)
- Startup greeting「老公，我来啦~」
- Context menu: 叫老公 / 磕头 / 上才艺
- Roaming: 老公喝茶, 爱你老公, 宝贝真棒, 老公辛苦了
- Perch actions: hair-flip, blow-kiss, look (removed cross-leg phone)
- build:laopo / build:customer delivery path

## Git Note

`/pets/work/` is gitignored (private source photos per AGENTS.md). Only `docs/prompts/make-laopo-pet.txt` committed — same pattern as boss (`3efae57` committed prompt only).

## Test Results

No automated tests required for this task. Manual verification:

- Ref file sizes > 0 ✓
- Visual read of both PNGs ✓
- Same-person identity anchor ✓

## Concerns

- Portrait ref shows beige ribbed top (indoor); animation outfit should follow fullbody ref (cream dress + lace layer) per IDENTITY.md.
- Long dress walk/dance frames will need extra skirt baseline checks during generation (noted in spec).

## Ready For

Task 4+ can use `IDENTITY.md`, refs, and `docs/prompts/make-laopo-pet.txt` to drive desktop-pet-maker image generation.
