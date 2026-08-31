# Task 3 Report: 把窗口边 opt-in 合回 niulai

## Status

Completed and committed on the isolated `feature/niulai` worktree at `D:\Vibe_Coding\desktop-pet\.worktrees\niulai`.

Commit:

- `368b76c feat: opt-in window-edge roles and shared capability gates on niulai`

## Changes

- Added `interactionRoleEnabled` to make climb, perch, and hang opt-in when `interactionActions` exists. A role is disabled when it is omitted, `null`, `false`, or has `enabled: false`; legacy packages that omit the entire `interactionActions` object retain all edge roles.
- Added the shared `src/capability-gates.js` and its test from the son-mode worktree.
- Gated office radar, DingTalk hangup, and market features by the active manifest capabilities; hid unsupported tray entries.
- Set both default task providers to `mock`; the niulai branch has no Feishu task notifier, so only the mock task path is runnable.
- Added niulai’s watch menu label as `办公雷达`. Existing `climb`, `perch`, and `hang` declarations remain enabled.

## TDD Evidence

### RED

Added side-window tests for a missing `climb` role and for `climb: { enabled: false }`, then ran:

```powershell
node scripts/test-interaction-controller.js
```

Observed the expected failure before implementation:

```text
AssertionError: omitting climb disables side-window cling
actual: 'climbing'
expected: 'normal'
```

### GREEN

Implemented the role gate and ran:

```powershell
node scripts/test-interaction-controller.js
node scripts/test-capability-gates.js
node scripts/test-pet-task.js
npm run test:js
```

All commands passed.

## Concerns

- No push was performed.
- No `brother-judge` resource was deleted or changed.
- The root working tree source was not modified; this report is the only root-workspace write.

## Review-fix verification — 2026-08-31

- RED: `node scripts/test-watch-config.js` and `node scripts/test-interaction-controller.js` failed as expected before the fix (`tasks` was undefined; disabled perch ended `perched`).
- GREEN: `node scripts/test-watch-config.js && node scripts/test-interaction-controller.js` passed.
- Full suite: `npm run test:js` passed (exit 0).
- No push performed; implementation commit follows on `feature/niulai`.
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