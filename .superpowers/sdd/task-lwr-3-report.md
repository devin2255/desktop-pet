# Task 3 Report: 工作区遇边掉头漫游

**Branch:** `feat/medusa-pet`  
**Date:** 2026-08-02  
**Status:** DONE (GREEN)

## Summary

Rewired roaming `walkTo` to walk along current facing and flip at work-area left/right edges via `nextRoamFacing`, continuing with `walk-left` / `walk-right` without mid-segment idle. Segment length comes from behavior `minDuration` / `maxDuration`; only runs when `interaction.state() === 'normal'`.

## Steps Completed

### Step 1: Edge-turn roam walk

`src/main-v3.js`:

- `require('./roam-edge').nextRoamFacing`
- `walkTo(durationMs)` moves ±2px per 16ms tick by facing
- On edge: `nextRoamFacing` → update facing → `sendState('walk-' + facing)` → keep walking (no idle)
- Duration expiry → `stopWalk` → `idle` → `scheduleBehavior`
- Tick / entry gated on `interaction.state() === 'normal'`
- `runBehavior` walk path passes computed duration instead of a random target X

`src/roam-edge.js` / `scripts/test-roam-edge-turn.js` / `package.json` `test:js` already present from Task 1 (no further change needed).

### Step 2: Tests

```powershell
node scripts/test-roam-edge-turn.js
node --check src/main-v3.js
node scripts/test-interaction-controller.js
```

| Check | Result |
|-------|--------|
| `test-roam-edge-turn.js` | **GREEN** — `roam-edge-turn: all assertions passed` |
| `node --check src/main-v3.js` | **GREEN** exit 0 |
| `test-interaction-controller.js` | **GREEN** — `interaction controller checks passed` |

### Step 3: Commit

| SHA | Subject |
|-----|---------|
| `16a7611` | `feat: turn around at work-area edges while roaming` |

## Next Task

Task 4: regenerate walk + new lean assets and pack.
