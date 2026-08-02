# Task 1 Report: Validator + interaction 测试先红 / roam-edge 先绿

**Branch:** `feat/medusa-pet`  
**Date:** 2026-08-02  
**Status:** DONE (TDD RED for lean; GREEN for roam-edge)

## Summary

Allowed `lean` in `INTERACTION_ROLES` (JS + Python). Rewrote side-edge interaction assertions for immediate lean / no climb travel. Extracted `src/roam-edge.js` with `nextRoamFacing` and a green unit test wired into `test:js`.

## Steps Completed

### Step 1: 允许 `lean` 角色

- `src/petpack-validator.js`: added `'lean'` to `INTERACTION_ROLES`
- `skills/desktop-pet-maker/scripts/petpack_tool.py`: mirrored `lean` in `INTERACTION_ROLES`

### Step 2: 改 interaction 测试期望

`scripts/test-interaction-controller.js`:

- Side release → expect `lean-*` state + controller `leaning` + `climbs.length === 0`
- Former `climbHoldMs=3000` climb-to-top case → flush timers still asserts **no** climb travel and stays `leaning`
- Dispose cleanup on side path → lean (no climb animation frames)

### Step 3: 掉头纯函数

- Created `src/roam-edge.js` with `nextRoamFacing(facing, x, width, workArea)`
- Created `scripts/test-roam-edge-turn.js` (right→left, left→right, mid unchanged)
- Added `node --check src/roam-edge.js` and `test-roam-edge-turn.js` to `package.json` `test:js`

### Step 4: 跑测试

```powershell
node scripts/test-roam-edge-turn.js
node scripts/test-interaction-controller.js
```

| Check | Result | Notes |
|-------|--------|-------|
| `test-roam-edge-turn.js` | **GREEN** exit 0 | `roam-edge-turn: all assertions passed` |
| `test-interaction-controller.js` | **RED** exit 1 | Expected until Task 2 implements lean |

First failing assertion:

```
AssertionError [ERR_ASSERTION]: side release enters lean facing into the window
    at run (...\scripts\test-interaction-controller.js:245:12)
```

Cause: controller still uses `climbToTop` on side release (`climb-right` / perch), not `leanOnSide`.

### Step 5: Commit

| SHA | Subject |
|-----|---------|
| `cc16ca3` | `test: lean role validator and edge-turn; side lean assertions RED for Task 2` |

Committed all Task 1 files together (validator, roam-edge + green test, interaction RED assertions, package.json, this report). Interaction RED is intentional for Task 2.

## Next Task

Task 2: implement `leanOnSide` in `interaction-controller.js` (+ renderer fallback / facingState for lean) until interaction tests go GREEN.
