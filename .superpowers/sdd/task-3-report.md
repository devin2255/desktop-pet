# Task 3 Report: 主进程菜单、三停、点击收工、窗尺寸

## Status

Implemented Task 3 in `src/main-v3.js` and `src/preload-v3.js`.

No git commit was created.

## TDD Evidence

RED first:

```powershell
node scripts/test-capability-gates.js; node scripts/test-duo-renderer-contract.js
```

Observed expected failures before production code:

```text
AssertionError [ERR_ASSERTION]: slack is gated by duo.slack
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /slackExit/
```

GREEN after implementation:

```powershell
node scripts/test-capability-gates.js; node scripts/test-duo-renderer-contract.js; node --check src/main-v3.js; node --check src/preload-v3.js
```

Observed passing output:

```text
test-capability-gates: ok
test-duo-renderer-contract: ok
```

`node --check` produced no output and exited 0 for both files.

## Implementation

- `makeDuoController()` now gates slack with `hasDuoSlack(activeManifest)`.
- `windowSize()` passes `slackExtraHeight: TENT_EXTRA_HEIGHT` through `presentationWindowSize(...)`.
- Folded Duo menu now shows `duo.slack.enterLabel || '摸会儿鱼'` only when `hasDuoSlack(activeManifest)`.
- Added `duo-slack` / `duo-unslack` main-process menu handling.
- Added `slackViaMenu()` with intro -> jump -> carry staging, slack window placement, overlay `phase: 'slack'`, `slackStage`, intro frame URLs, clips URLs, and no behavior reschedule while slack is active.
- Added `leaveSlackViaMenu()` and trusted `pet:slack-exit` handler to clear timers, hide overlay, restore folded size, send idle, resume behavior, and restart office bus gate.
- Slack now suspends roaming behavior, interaction controller actions, office bus dispatch, watch-state dispatch, and Duo open/close pointer handling.
- Market polling remains gated only by the existing market capability and is not disabled by slack.
- `preload-v3.js` exposes `petApi.slackExit()` -> `pet:slack-exit`.

## Tests

Passed:

```powershell
node scripts/test-capability-gates.js
node scripts/test-duo-renderer-contract.js
node --check src/main-v3.js
node --check src/preload-v3.js
```

## Concerns

- Renderer drawing/click threshold behavior is intentionally left for Task 4.
- This task did not launch the Electron app manually; validation was limited to the requested contract tests and syntax checks.
