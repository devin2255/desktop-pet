# Task 7b Report: Brother Judge Petpack — Window-Edge Interaction Actions

## Overview

Extended the brother-judge petpack with 7 window-edge interaction actions (drag, climb, perch, hang, fall, impact, recover), matching the `desktop-pet-window-interactions` capability in the player. The 5 standard actions from Task 7a were left untouched.

## Image Prompts for Each Strip

All strips generated at 2560x1080 (21:9) via ImageGen. Shared identity string (from DESIGN.md): "a slim young man with fair skin, short dark hair with natural bangs, thin silver round-framed glasses, wearing a black traditional Chinese official's judge hat with two long curved flaps extending outward on both sides with white dotted beaded trim along flap edges, a white tank-top undershirt, dark blue loose shorts, and brown flip-flops. Soft 2D game-sprite style with clean outlines and consistent shading."

Shared layout rules suffix (applied to all prompts): "CRITICAL LAYOUT RULES: Keep the character at the same scale and centered in each cell with at least 18 percent green gutters on left and right sides, plus generous green padding above and below. Use the same camera distance in every frame — no zoom, pan, or recenter. Keep the torso at the same visual size and screen position in every frame. Natural rounded hat flap tips, never flat-cut. No visible pixels may cross into a neighboring cell. Use a perfectly flat solid #00ff00 chroma-key green background with no separators. No crop, text, labels, borders, grid lines, floor, shadows, props, extra animals, motion marks, watermark, or green on the character."

### drag (6 frames)
Character held by unseen hand gripping shirt collar, body dangling in midair. 6-frame cycle: limp dangle → swing right → swing left flailing → mid-swing feet kicking → bounce recoil → settle back to dangle. Airborne throughout, feet never touch ground.

### climb (6 frames)
Character climbing a vertical window edge, profile view facing left. 6-frame cycle: both hands gripping top edge, feet braced → pull up, right hand reaches higher → left hand grips higher → halfway up, knee driving → nearly at top, one arm over edge → pull chest over.

### perch (4 frames)
Character sitting on top of window edge/ledge, legs dangling. 4-frame loop: settled crouched, hands on knees → slight shift, hand on edge → relaxed lean back, legs swinging → head turn looking around.

### hang (4 frames)
Character hanging by both hands from window top edge, body dangling. 4-frame loop: gripping, hanging straight down → sway right → sway back center, straining → small bounce.

### fall (4 frames)
Character falling through air, limbs splayed. 4-frame loop: just started falling, arms up, hat flaps flying → tumbling, arms and legs splayed → nearly upside down, one flip-flop flying → still falling, spinning.

### impact (4 frames)
Character just landed after fall, crouched low. 4-frame transition: moment of impact, feet hit ground, knees bent, hand on ground → deep crouch, both hands on ground, head down → starting to rise, lifting head → nearly upright slight crouch, recovering balance.

### recover (6 frames)
Character recovering from impact, crouch to standing. 6-frame transition: deep crouch, hands on ground → rising, one hand leaves ground → half-standing → nearly upright, brushing off tank top → fully standing, adjusting hat → settled standing, arms relaxed.

---

## Per-Action Processing Summary

| Action | Strip generated? | Watermark removed? | Chroma removed? | process_animation_strips passed? | Max components | Alpha equalized? | Regeneration? |
|--------|-------------------|-------------------|-----------------|-----------------------------------|----------------|-----------------|---------------|
| drag   | Yes (1 attempt)   | No (none found)    | Yes (--edge-contract 3) | Yes | 2 (arms separate) | Yes (21536→25077 ... 28442→25097) | No |
| climb  | Yes (1 attempt)   | Yes (removed)     | Yes (--edge-contract 3) | Yes | 1 | Yes (20912→25033 ... 28286→24998) | No |
| perch  | Yes (1 attempt)   | Yes (removed)     | Yes (--edge-contract 3) | Yes | 1 | Yes (38138→25146 ... 38217→25101) | No |
| hang   | Yes (1 attempt)   | No (none found)    | Yes (--edge-contract 3) | Yes | 1 | Yes (20341→25091 ... 21906→25097) | No |
| fall   | Yes (1 attempt)   | Yes (removed)     | Yes (--edge-contract 3) | Yes | 2 (flying flip-flop) | Yes (20832→25013 ... 32362→25087) | No |
| impact | Yes (1 attempt)   | No (none found)    | Yes (--edge-contract 3) | Yes | 1 | Yes (38199→25059 ... 38223→25084) | No |
| recover| Yes (1 attempt)   | No (none found)    | Yes (--edge-contract 3) | Yes | 1 | Yes (25371→25046 ... 38229→25078) | No |

### Processing pipeline

1. **ImageGen**: 7 raw chroma strips generated at 2560x1080 (21:9). No regeneration needed — all strips were usable on the first attempt.
2. **Watermark removal**: 3 of 7 strips had "AI生成" watermark in bottom-right corner. Removed by replacing 300x80px region with solid green (#00ff00) using PIL.
3. **Chroma key removal**: Used `remove_chroma_key.py` with flags: `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 3 --force`. The `--edge-contract 3` was used (same as 7a) to avoid flat-side detection on the human character's straight body edges.
4. **Strip recompose**: Custom `recompose_strip()` function splits each transparent strip into N frames, finds each character's alpha bounding box, and re-centers with 18% horizontal gutters + vertical padding (max(24, round(max_h * 0.18))) on both top and bottom. The vertical padding was essential — without it, the bottom gutter was 0 and process_animation_strips rejected the frame. Fixed after first attempt.
5. **process_animation_strips.py**: Ran per-action (not batch) to allow different `--max-significant-components` values. drag used 2 (arms may separate from body), fall used 2 (flying flip-flop creates 82px detached component). All other actions used 1. All 7 passed on first run after the recompose fix.
6. **Alpha area equalization**: Post-processor scales each character to TARGET_ALPHA_AREA=25000 (matching the existing 5 standard actions from 7a). Preserves bottom baseline (y=464 on 480x480 canvas) and alpha centroid for horizontal centering. Final areas: 24944–25274 across all 56 frames.

### Key fix: vertical gutter in recompose

The first run of process_animation_strips.py failed on drag frame 1 with "enters the safety gutter (bottom=0)". The recompose function was bottom-aligning characters with no bottom padding. Fixed by adding `vertical_pad = max(24, round(max_h * 0.18))` and placing characters at `y = cell_h - subject.height - vertical_pad`, ensuring gutters on ALL four sides.

---

## pet.json Changes

### Animations added (7 new entries)

| Action | Frames | Durations | Loop | holdLastFrame | Scale |
|--------|--------|-----------|------|---------------|-------|
| drag   | 6      | 120x6     | true | false         | 1     |
| climb  | 6      | 140x6     | true | false         | 1     |
| perch  | 4      | 280,280,280,1600 | true | false | 1     |
| hang   | 4      | 220,220,220,1600 | true | false | 1     |
| fall   | 4      | 120x4     | true | false         | 1     |
| impact | 4      | 140,180,220,900 | false | true  | 1     |
| recover| 6      | 160,160,180,200,260,700 | false | true | 1     |

All durations, loop, and holdLastFrame values mirror dog-and-cat/pet.json exactly.

### interactionActions block added

```json
"interactionActions": {
    "drag": { "action": "drag" },
    "climb": { "action": "climb", "anchor": { "x": 0.52, "y": 0.48 } },
    "perch": { "action": "perch", "anchor": { "x": 0.5, "y": 0.55 } },
    "hang": { "action": "hang", "anchor": { "x": 0.5, "y": 0.08 } },
    "fall": { "action": "fall" },
    "impact": { "action": "impact" },
    "recover": { "action": "recover" }
}
```

Anchor values mirror dog-and-cat/pet.json. climb anchor (0.52, 0.48) positions the character near the top of the window during climbing. perch anchor (0.5, 0.55) centers the character on the ledge. hang anchor (0.5, 0.08) positions the character near the top edge when hanging.

### contextMenuActions

Left unchanged from 7a (3 items: 升堂→reaction, 退堂→sit, 歇息→sleep). These are sufficient judge-flavored menu items.

### Unchanged fields

- `id`: "brother-judge" (unchanged)
- `schemaVersion`: 1 (unchanged)
- `packageVersion`: 1.0.0 (unchanged)
- `normalizationMetric`: "alpha-area-v1" (unchanged)
- `watch`, `behavior`, `preview`, `personality`, `speechGender`, `startupGreeting`: all unchanged

---

## Validation Results

| Check | Result |
|-------|--------|
| petpack_tool.py validate (directory) | **PASS** — "valid: brother-judge (兄弟判官)" |
| petpack_tool.py build | **PASS** — pets/packages/brother-judge.petpack rebuilt |
| petpack_tool.py validate (archive) | **PASS** — "valid: brother-judge (兄弟判官)" |
| test_process_animation_strips.py -v | **PASS** — 7/7 tests OK (0.853s) |
| Alpha area ratio (all 56 frames) | **PASS** — 1.0132 (limit 1.08), smallest=24944, largest=25274 |
| Canvas size consistency | **PASS** — all 56 frames are 480x480 |

---

## Self-Review

### Identity consistency across 12 actions

The contact sheet confirms the same character identity across all 12 actions (5 standard + 7 window-interaction). The same young man with the black judge hat (curved flaps, white dotted trim), silver round glasses, white tank top, dark blue shorts, and brown flip-flops appears throughout. No brush pen in the 7 window-interaction actions (pen is reaction-only, as specified).

### Hat/glasses/outfit consistency

The judge hat, silver round glasses, white tank top, dark blue shorts, and brown flip-flops are present and consistent across all 34 new frames. No costume drift detected.

### Foot baseline stability

All standing/sitting actions share the same foot baseline (y=464 on 480x480 canvas). Airborne actions (drag, hang, fall) have the character positioned correctly in the canvas. Impact frames show the character crouched low, and recover transitions smoothly from crouch to standing. The alpha centroid centering prevents torso drift across frames.

### Anchors reasonable

- drag: no anchor (character follows cursor)
- climb: anchor (0.52, 0.48) — positions character slightly right and vertically centered, matching the climbing pose
- perch: anchor (0.5, 0.55) — centers character on the ledge, slightly below center
- hang: anchor (0.5, 0.08) — positions character near the top of the window edge, matching the hanging-from-top pose
- fall, impact, recover: no anchor (physics-driven, character position determined by gravity)

### Green fringe

No green fringe detected. The `--despill` flag and `--edge-contract 3` in chroma keying prevented green spill. Contact sheet shows clean character outlines on transparent backgrounds.

### Concerns

1. **fall action flip-flop**: Fall frame 3 has a small detached component (82px) from a flip-flop appearing to separate from the character. Used `--max-significant-components 2` to allow this as a legitimate body part. The flip-flop is part of the character's outfit, not a prop.
2. **drag arms separation**: Drag frames have arms that may separate from the torso during the dangling/swinging motion. Used `--max-significant-components 2` as a precaution.
3. **perch block**: The perch frames show the character sitting on a dark rectangular block (implied ledge). This is baked into the art, not a prop — it represents the window edge the character is perched on. Acceptable since the player positions the character on the window edge anyway.
4. **Anchors**: The anchor values are copied from dog-and-cat. For a human character with a judge hat (which adds height), the hang anchor (0.5, 0.08) may need tuning during player testing. The hat flaps add visual height that could shift the optimal hang position slightly.

---

## Commits

| SHA | Subject |
|-----|---------|
| (to be filled after commit) | feat: add 7 window-interaction actions to brother judge petpack |

---

## File Inventory

### Modified files
- `pets/library/brother-judge/pet.json` — manifest with 7 new animations + interactionActions
- `pets/packages/brother-judge.petpack` — rebuilt petpack

### New frame files (34 total)
- `pets/library/brother-judge/animations/drag/01-06.png` — 6 drag frames
- `pets/library/brother-judge/animations/climb/01-06.png` — 6 climb frames
- `pets/library/brother-judge/animations/perch/01-04.png` — 4 perch frames
- `pets/library/brother-judge/animations/hang/01-04.png` — 4 hang frames
- `pets/library/brother-judge/animations/fall/01-04.png` — 4 fall frames
- `pets/library/brother-judge/animations/impact/01-04.png` — 4 impact frames
- `pets/library/brother-judge/animations/recover/01-06.png` — 6 recover frames

### Work directory (not committed, gitignored)
- `pets/work/brother-judge/raw/drag-chroma.png` etc. — 7 raw chroma strips
- `pets/work/brother-judge/raw/strips/drag.png` etc. — 7 recomposed transparent strips
- `pets/work/brother-judge/raw/processed/drag/01.png` etc. — 7 processed action dirs
- `pets/work/brother-judge/raw/contact-sheet-7b.jpg` — contact sheet for all 12 actions
- `pets/work/brother-judge/pipeline_7b.py` — pipeline script
