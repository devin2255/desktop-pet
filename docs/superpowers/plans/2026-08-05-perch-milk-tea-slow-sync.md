# Synchronized Milk Tea Perch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Xiaomei-Xiaotian’s six-frame window-top milk-tea loop so both women always hold one drink each, sip together, and slowly swing their legs in a stable four-second cycle.

**Architecture:** Keep the generic player and `perch-milk-tea` manifest interface unchanged. Generate one identity-consistent six-cell source strip from the authorized local reference, pass it through the existing strip safety/chroma/normalization pipeline, replace only the six ignored customer frames and manifest timing, then rebuild and validate the local `.petpack` delivery artifact.

**Tech Stack:** GPT Image generation, PNG chroma-key/alpha processing, Pillow-based animation strip safety tooling, JSON `.petpack` manifest, Node assertion tests, Python petpack validator.

## Global Constraints

- Preserve both authorized people’s faces, hair, age, body shape, light outfits, and photorealistic style.
- Every frame contains exactly two complete people and exactly two milk-tea cups, one cup held by each person.
- Both people raise, sip, lower, and gently swing their legs synchronously.
- Use exactly six frames with durations `[600, 650, 850, 650, 650, 600]`, `loop: true`, and `holdLastFrame: false`.
- Keep action id `perch-milk-tea`, `interactionActions.perch.action`, and `schemaVersion` unchanged.
- Keep camera distance, visual body mass, center of gravity, seated/window baseline, hands, cups, straws, legs, and shoes continuous.
- Reject and regenerate any source cell with edge contact, neighboring fragments, significant detached components, clipped anatomy/cups, or flat truncation; do not repair a failed cell by erasing fragments.
- Preserve original/reference images and unrelated dirty workspace changes. Do not upload references to unrelated services.

---

### Task 1: Lock the Slow Timing Contract

**Files:**
- Modify: `scripts/test-bestie-petpack.js:82-90`
- Modify: `pets/library/xiaomei-xiaotian/pet.json:94-106`

**Interfaces:**
- Consumes: existing manifest action `animations["perch-milk-tea"]`.
- Produces: exact duration contract `[600, 650, 850, 650, 650, 600]` while preserving six frames and loop flags.

- [ ] **Step 1: Add a failing timing assertion**

Add after the existing perch assertions, using the validated packed manifest:

```js
assert.deepStrictEqual(
  manifest.animations['perch-milk-tea'].durations,
  [600, 650, 850, 650, 650, 600]
);
assert.strictEqual(manifest.animations['perch-milk-tea'].holdLastFrame, false);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:bestie`

Expected: FAIL showing the actual six `200` values differ from the expected slow durations.

- [ ] **Step 3: Update only the manifest timing**

Change the action entry to:

```json
"durations": [600, 650, 850, 650, 650, 600],
"loop": true,
"holdLastFrame": false
```

Do not change frame paths, action id, scale, schema version, or interaction mapping. Rebuild once so the package/library parity assertion reflects the timing change:

```text
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:bestie`

Expected: `test-bestie-petpack: ok`.

### Task 2: Generate and Gate the Six Synchronized Frames

**Files:**
- Preserve: `pets/work/bestie-reference.png`
- Preserve: `pets/work/xiaomei-xiaotian/source/standard/master-chroma.png`
- Replace source: `pets/work/xiaomei-xiaotian/source/standard/perch-milk-tea-chroma.png`
- Replace processed strip: `pets/work/xiaomei-xiaotian/source/transparent/perch-milk-tea.png`
- Replace frames: `pets/work/xiaomei-xiaotian/source/standard/frames/perch-milk-tea-01.png` through `06.png`
- Replace delivery frames: `pets/library/xiaomei-xiaotian/animations/perch-milk-tea/01.png` through `06.png`

**Interfaces:**
- Consumes: authorized identity reference and existing accepted character scale/style references.
- Produces: one safe six-cell transparent strip and six normalized 512×512 delivery frames.

- [ ] **Step 1: Read the asset-making rules before generation**

Read completely:

```text
skills/desktop-pet-maker/SKILL.md
skills/desktop-pet-maker/references/image-prompts.md
```

Use the image generation skill/tool with local identity references. Never overwrite the reference photo.

- [ ] **Step 2: Generate one six-cell chroma strip**

Use this exact choreography and constraints in the image prompt:

```text
Create one horizontal six-cell photorealistic animation strip of the same two authorized young women from the reference images, seated side by side on an invisible window ledge. Solid pure green background in every cell, equal cell widths, wide blank green safety margins on all four sides of every cell, no dividers, text, shadows, furniture, scenery, or cropped anatomy.

Both women wear the same accepted light cream outfits and shoes. Each woman holds her own separate matching milk-tea cup with lid and straw in every cell: exactly two people and exactly two cups per cell. Never merge, remove, exchange, duplicate, or change the cups.

Six synchronized poses: (1) both hold cups naturally in front, legs down; (2) both slowly raise cups toward their mouths while both legs begin a small forward swing; (3) both sip through straws at the same time and hold briefly, legs gently forward; (4) both slowly lower cups while legs return; (5) both hold cups in front while both legs make a small relaxed backward/down swing; (6) both still hold separate cups and lean lightly together, returning smoothly toward pose one.

Lock both torsos to identical visual size and screen position across all six cells. Fixed camera, fixed seated baseline, fixed hip positions, fixed spacing, continuous hands/fingers/cups/straws/legs/shoes. Only small synchronized arm and leg changes. Preserve exact faces, hair, age, body shape, clothing, and photorealistic identity. No zoom, pan, recentering, background residue, edge contact, neighboring-cell fragments, extra limbs, extra cups, or missing anatomy.
```

Save the accepted generated original under `pets/work/xiaomei-xiaotian/generated-originals/` and copy/export the working chroma strip to `source/standard/perch-milk-tea-chroma.png`. Do not overwrite earlier generated originals.

- [ ] **Step 3: Run the source-cell safety gate before cutting**

Remove chroma to `source/transparent/perch-milk-tea.png` using the desktop-pet-maker workflow, then run:

```text
python skills/desktop-pet-maker/scripts/process_animation_strips.py --input-dir pets/work/xiaomei-xiaotian/source/transparent --output-dir pets/work/xiaomei-xiaotian/processed-candidate --action perch-milk-tea:6 --max-significant-components 4
```

Expected: PASS for all six source cells with no edge contact, neighbor bleed, detached fragment, or flat-side truncation. If any cell fails, discard the entire generated candidate and repeat Step 2; do not erase failed fragments.

- [ ] **Step 4: Inspect every candidate frame visually**

Inspect all six processed frames at original detail and record a frame-by-frame checklist:

```text
01 two identities / two cups / neutral legs
02 two identities / two cups / both cups rising / legs forward-start
03 two identities / two cups / both simultaneously sipping / legs forward-hold
04 two identities / two cups / both cups lowering / legs returning
05 two identities / two cups / cups down / legs gentle back-down
06 two identities / two cups / light lean / loop-compatible legs
```

Reject the candidate if any cup, straw, hand, face, leg, or shoe changes identity or disappears; if body scale/centroid/baseline jumps; or if any nontransparent background residue remains.

- [ ] **Step 5: Promote the accepted normalized frames**

Copy the accepted six output frames to both destinations, preserving the existing 512×512 transparent canvas convention:

```powershell
1..6 | ForEach-Object {
  $number = $_.ToString('00')
  Copy-Item -LiteralPath "pets/work/xiaomei-xiaotian/processed-candidate/perch-milk-tea/$number.png" -Destination "pets/work/xiaomei-xiaotian/source/standard/frames/perch-milk-tea-$number.png"
  Copy-Item -LiteralPath "pets/work/xiaomei-xiaotian/processed-candidate/perch-milk-tea/$number.png" -Destination "pets/library/xiaomei-xiaotian/animations/perch-milk-tea/$number.png"
}
```

Confirm source originals remain separate.

### Task 3: Rebuild, Validate, and Runtime-Check the Delivery

**Files:**
- Regenerate: `pets/packages/xiaomei-xiaotian.petpack`
- Verify: `pets/library/xiaomei-xiaotian/pet.json`
- Verify: `scripts/test-bestie-petpack.js`

**Interfaces:**
- Consumes: accepted six frames and slow timing contract from Tasks 1–2.
- Produces: validated local `.petpack` with the new synchronized milk-tea loop.

- [ ] **Step 1: Rebuild the package**

Run:

```text
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
```

Expected: exits 0 and writes the package without changing unrelated assets.

- [ ] **Step 2: Validate package and automated regressions**

Run:

```text
npm run test:bestie
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaomei-xiaotian.petpack
node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: all commands exit 0; package validates as `xiaomei-xiaotian`; all strip safety tests pass.

- [ ] **Step 3: Verify packed parity and unchanged unrelated assets**

Parse library and packed root `pet.json` and assert deep equality. SHA-256 compare every packaged animation asset against the library, and confirm only the six `perch-milk-tea` images differ from the pre-task package snapshot.

- [ ] **Step 4: Run a bounded player smoke test**

Launch `npm start` and verify no startup exception. If GUI control is available, attach the pet to a window top and observe at least 10 complete loops, confirming two persistent cups, synchronized sipping, slow synchronized leg swing, stable scale/baseline, transparent background, target-window following, drag release, and unchanged side-rest behavior. If GUI control is unavailable, explicitly report these visual checks as unverified.

- [ ] **Step 5: Review scope and delivery state**

Run `git status --short` and scoped diffs. Do not force-add ignored customer/reference/generated assets. Commit only the tracked regression test if changed; leave the rebuilt `.petpack`, manifest, and frames as local delivery artifacts according to repository policy.
