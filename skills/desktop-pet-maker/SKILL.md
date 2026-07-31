---
name: desktop-pet-maker
description: Create reusable animated `.petpack` desktop-pet packages from one or more pet photos. Use when Codex needs to turn cat, dog, or other pet reference photos into identity-consistent GPT Image animation frames, remove chroma backgrounds, normalize frames, generate a manifest, validate the package, or prepare a pet for the universal Desktop Pet Player.
---

# Desktop Pet Maker

Create one validated `.petpack` for the universal Desktop Pet Player. Keep image generation creative; keep frame processing, validation, and packaging deterministic.

## Workflow

1. Locate 1–8 photos of the same pet. Prefer a clear face, side view, and full body. Do not mix animals.
2. Record the pet name and personality. Derive a lowercase ASCII package id; use hyphens only.
3. Inspect every reference image. Summarize stable identity traits: species, body shape, coat colors and markings, face, ears, eyes, muzzle, legs, and tail.
4. Read [references/image-prompts.md](references/image-prompts.md). Use the built-in image generation tool, with the reference photos or approved master image, to generate the standard green-screen strips:
   - `idle`: 4 frames
   - `walk`: 6 frames facing right
   - `sit`: 4 frames
   - `sleep`: 4 frames
   - `reaction`: 4 frames matching the personality
5. Save generated strips as `<action>-chroma.png`. Preserve generated originals.
6. Remove the chroma background with the installed imagegen helper. Use `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`.
7. Run `scripts/process_animation_strips.py` on the five transparent strips. The script must reject any source cell that enters its safety gutter, has a suspicious flat side cut, or contains a significant detached component. Treat these failures as sprite-sheet cell bleeding or body/ear/tail clipping: regenerate the strip with wider gutters. Never erase a leaked fragment and continue, because the missing pixels cannot be recovered.
8. The processor must normalize every frame to one shared canvas and foot baseline, use opaque visual mass for scale, and align the alpha centroid so tail motion cannot shift the torso. Inspect the contact sheet for identity drift, green fringe, duplicate or empty frames, incomplete or flat-cut tail tips, unstable baselines, and apparent zoom/pan within or between actions.
9. Run `scripts/create_pet_manifest.py` with the pet id, name, personality, preview, and frames directory.
10. Read [references/petpack-schema.md](references/petpack-schema.md) when changing fields or animation behavior.
11. Run `scripts/petpack_tool.py validate <pet-directory>`, then `build <pet-directory> <output.petpack>`.
12. Deliver the `.petpack`, contact sheet, manifest path, and the final image prompt set. Import it into the player when the player project is available.

## Quality gates

- Keep one recognizable pet identity across all 22 frames.
- Keep one animal per frame, the whole body and complete natural tail tip visible, and the feet or lying body on a stable baseline.
- Require empty left/right safety gutters in every source cell. Reject cell-edge contact, neighboring-frame fragments, flat-cut extremities, or any manual cleanup that merely deletes the spill.
- Reject baked text, labels, borders, shadows, props, motion marks, or green-screen remnants.
- Use the right-facing walk strip for left movement by mirroring in the player.
- Normalize by opaque visual mass and alpha centroid, not by the full bounding-box center. Tail motion must not make the torso grow, shrink, or translate.
- Rapidly replay `reaction` at least 50 times in the regression check. The pet's CSS scale and anchor must remain absolute, and stationary clicks must not move the window.
- In the player, transparent pixels outside the visible pet must pass mouse input through to applications behind the desktop-pet window.
- Do not rebuild or fork the player for a new pet. Keep pet-specific work inside the `.petpack`; when this skill runs inside the Desktop Pet Player repository, continue with the repository instructions to build and verify the customer EXE.
- Do not silently accept a malformed package; fix validation failures before delivery.

## Defaults

- Use the soft 2D game-sprite style unless the user specifies another style.
- Use personality only to shape `reaction` poses and dialogue metadata; do not change stable physical traits.
- Produce a first complete version without asking for aesthetic approval when sufficient photos are present. Invite refinement after delivery.
