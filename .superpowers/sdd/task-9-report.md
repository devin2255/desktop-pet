# Task 9 Report: 雷达打到左窗

**Status:** DONE  
**Commits:** none

Task 4 already implemented `targetWatchWindow()` / `dispatchWatchState()`:
- folded → `petWindow`
- open → window for `duo.members.find((m) => m.watch === true)` (judge/left)

Added source-gate asserts in `scripts/test-capability-gates.js`.

`node scripts/test-capability-gates.js` → ok
