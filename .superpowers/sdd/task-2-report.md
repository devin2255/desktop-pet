# Task 2 Report: petpack 校验与 schema（sequences）

## Status: Complete

## Summary

Implemented manifest validation for `sequences` and context-menu `sequence` references in both the JavaScript validator and Python petpack tool, with schema documentation and focused tests.

## Changes

### `src/petpack-validator.js`

- Added `SEQUENCE_ID_PATTERN` and `MAX_SEQUENCES` (8).
- New `sequences` validation block (after required/interaction animations, before `contextMenuActions`):
  - Optional object; keys `^[a-z0-9][a-z0-9-]{1,31}$`; max 8 entries.
  - Each sequence requires `stages` array length 2..16.
  - Stage rules: required `action` in `animations` (full `validateAnimation` on first use); optional `message`≤80, `messages` 1..4×≤80, `messageGapMs` 0..5000, `duration` 0..10000, `waitForClick` boolean.
- Refactored `contextMenuActions`: exactly one of `action` or `sequence`; `sequence` must exist in `manifest.sequences`; forbids `message`/`duration` on sequence items; legacy `action` path unchanged.

### `skills/desktop-pet-maker/scripts/petpack_tool.py`

- Mirrored all JS rules with equivalent Python checks and error messages.

### `skills/desktop-pet-maker/references/petpack-schema.md`

- Documented `sequences`, stage fields, and context-menu `action` vs `sequence` semantics.

### `scripts/test-sequences-schema.js` (new)

- Fixtures satisfy `REQUIRED_ACTIONS` frame counts (idle 4, walk 6, sit 4, sleep 4, reaction 4).
- Uses positional `validateManifest(manifest, '', false)`.
- Covers valid sequence menu, dual action+sequence rejection, missing sequence, forbidden message/duration on sequence menu, short stages, unknown stage action, and legacy action menu.

### `skills/desktop-pet-maker/scripts/test_petpack_tool.py`

- Added `test_sequences_and_context_menu_sequence_validation`.

### `package.json`

- Wired `scripts/test-sequences-schema.js` into `test:js`.

## Test Results

| Command | Result |
|---------|--------|
| `node scripts/test-sequences-schema.js` | PASS |
| `npm run test:js` | PASS (all 12 JS test scripts) |
| `npm run test:python` | New sequence test PASS; 6 pre-existing errors due to missing `pets/packages/xiaogou.petpack` fixture (unrelated to this task) |

## Commits

None (per instructions).

## Concerns / Notes

1. Python archive tests still reference `xiaogou.petpack`, which is absent in this workspace; consider switching fixture to `laopo.petpack` in a follow-up.
2. Sequence menu items still allow `speech` / `speechAudio` (brief only forbids `message`/`duration`); runtime integration is Task 3+.
3. Stage `duration` is optional even without `waitForClick`; runtime defaults to 3000 ms — matches Task 1 behavior.

## Files Touched

- `src/petpack-validator.js`
- `skills/desktop-pet-maker/scripts/petpack_tool.py`
- `skills/desktop-pet-maker/references/petpack-schema.md`
- `scripts/test-sequences-schema.js` (created)
- `skills/desktop-pet-maker/scripts/test_petpack_tool.py`
- `package.json`
