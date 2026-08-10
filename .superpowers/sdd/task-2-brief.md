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

