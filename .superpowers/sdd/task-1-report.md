# Task 1 Report: 通用跪爬模式 + 菜单上限 12

**Branch:** `feature/bestie-pets-design`  
**Status:** DONE  
**Date:** 2026-08-27

## Summary

Implemented generic kneel-crawl mode in the player (ported from `feature/son-mode` patterns) and raised `contextMenuActions` maximum from 8 to 12 across validator, Python tool, and schema docs. No guimi petpack was built (per task scope).

## Changes

### Created

| File | Purpose |
|------|---------|
| `src/roam-motion.js` | `nextRoamTarget()` edge-aware roam targeting; `crawlIdleState()` facing helper |
| `scripts/test-roam-motion.js` | Unit tests for roam-motion exports |
| `scripts/test-crawl-mode-wiring.js` | Source-contract tests for crawl wiring + menu limit 12 |

### Modified

| File | Change |
|------|--------|
| `src/main-v3.js` | Import roam-motion; `settings.crawlMode` (default `false`); `lastWalkFacing`; `idleState()`; crawl-aware `walkTo`/`chooseBehavior`/`runBehavior`; kowtow→kowtow-crawl remap; tray「跪爬模式」checkbox with `visible: Boolean(activeManifest?.animations?.crawl)` |
| `src/renderer-v3.js` | `resolveAction` maps `crawl-left`/`crawl-right` → `crawl`; `isFacingLeft` includes `state-crawl-left` |
| `src/styles-v3.css` | Mirror transform for `.state-crawl-left .pet-image` |
| `src/petpack-validator.js` | `contextMenuActions.length > 12` error message |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | at most 12 contextMenuActions |
| `skills/desktop-pet-maker/references/petpack-schema.md` | Document 12-entry limit |
| `package.json` | `test:js` adds `--check src/roam-motion.js`, `test-roam-motion.js`, `test-crawl-mode-wiring.js` |
| `scripts/test-interaction-controller.js` | VM context for `chooseBehavior` now includes `settings = { crawlMode: false }` (required after crawl guard added) |

## Interfaces Delivered

- `settings.crawlMode: boolean` — persisted via existing `loadSettings`/`saveSettings` spread
- `crawlIdleState(facing)` → `'crawl-left' | 'crawl-right'`
- `nextRoamTarget(bounds, workArea, rng, lastDirection)` → `{ targetX, direction }`
- Tray item `label: '跪爬模式'`, `visible` when manifest has `animations.crawl`
- Validator allows up to 12 `contextMenuActions`

## TDD Flow

1. Wrote `scripts/test-roam-motion.js` and `scripts/test-crawl-mode-wiring.js` before implementation (roam-motion test would fail until module created).
2. Implemented `src/roam-motion.js` and player wiring.
3. Fixed regression in `test-interaction-controller.js` caused by `chooseBehavior` referencing `settings`.

## Verification

All commands from task brief — exit 0:

```powershell
node scripts/test-roam-motion.js          # roam-motion: all tests passed
node scripts/test-crawl-mode-wiring.js    # test-crawl-mode-wiring: ok
node --check src/main-v3.js
node --check src/renderer-v3.js
node --check src/roam-motion.js
npm run test:js                           # full suite passed
```

## Self-Review

- **Scope:** No guimi petpack, no role-specific player branches — aligned with global constraints.
- **Son-mode parity:** Crawl walk/idle, roam targeting, kowtow remap, tray checkbox placement after「在桌面散步」match reference branch.
- **Persistence:** `crawlMode` merges into settings JSON automatically; no migration needed.
- **Edge case:** `runDirectMenuAction` kowtow remap runs after initial animation existence check — requires base `kowtow` animation in manifest (same as son-mode).
- **Extra diff:** `test-interaction-controller.js` one-line fix was not in brief but required for green `npm run test:js`.

## Commits

Skipped per global constraints (no user commit request).

## Concerns

None blocking. Crawl menu visibility and behavior only activate when a loaded petpack defines `animations.crawl`; laopo demo petpack unaffected.
