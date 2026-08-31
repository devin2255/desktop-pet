# Task 3 Report: 日常五动作 + drag

**Status:** DONE_WITH_CONCERNS
**Engine:** Cursor GenerateImage in Grok session (NOT OpenAI image2 / image_gen.py)

## Deliverables

| Action | Frames | Path |
|---|---|---|
| idle | 4 | pets/library/guimi/animations/idle/ |
| walk | 6 | pets/library/guimi/animations/walk/ |
| sit | 4 | pets/library/guimi/animations/sit/ |
| sleep | 4 | pets/library/guimi/animations/sleep/ |
| reaction | 4 | pets/library/guimi/animations/reaction/ |
| drag | 6 | pets/library/guimi/animations/drag/ |

## Pipeline notes

- Strip regen often failed equal-cell bleed; walk/drag finished via single-frame generate → chroma → compose_strip → process.
- Dual-person process used `--max-significant-components 2 --flat-side-ratio 0.18` (same convention as prior bestie tasks).
- Helper scripts under pets/work/guimi/scripts/: whiten_to_green.py, fit_cell_gutters.py, compose_strip.py

## Concerns

- Likeness vs fan refs is approximate; left JK / right pink outfit anchors are present.
- Some frames show linked-arm walk / peace-sign idle extras not strictly required.
- sit/sleep/reaction used strip path; walk/drag used composed singles.

## Tests

- process_animation_strips for all six actions: exit 0