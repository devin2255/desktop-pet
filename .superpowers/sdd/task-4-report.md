# Task 4 Report: 渲染三拍 + 左屏板 + 右屏视频 + 点击收工

## Status

DONE_WITH_CONCERNS. Implemented the renderer-side Duo slack overlay contract:
intro/jump/carry stages, left leaf intro/market board, right leaf intro/video,
ticker suppression during slack, and stationary left-click `slackExit`.

No PNG/video assets were generated and no git commit was made.

## TDD

### RED

Added contract assertions to `scripts/test-duo-renderer-contract.js` for:

- `duo-slack-board`
- `duo-slack-video`
- `duo-intro-left`
- `duo-intro-right`
- `slackStage`
- `slackExit`
- `[data-phase="slack"]`
- `--duo-open: 1`
- no `douyin.com` in HTML

Initial run:

```text
node scripts/test-duo-renderer-contract.js
AssertionError: input did not match /duo-slack-board/ (exit 1)
```

Added interaction assertions to `scripts/test-renderer-interaction.js` for:

- stationary left click during `phase:'slack'` calls `petApi.slackExit()`
- the same click does not call normal `interact()`
- left drag past threshold during slack does not call `slackExit()`

After fixing the test DOM fixture to support `dataset`, the red failure was:

```text
node scripts/test-renderer-interaction.js
AssertionError: stationary left click during slack should exit slack mode
0 !== 1 (exit 1)
```

### GREEN

Implemented:

- HTML nodes inside `.duo-device-leaf-left/right`:
  `#duo-intro-left`, `#duo-slack-board`, `#duo-intro-right`, `#duo-slack-video`.
- CSS for `[data-phase="slack"]`, full-open fold state, hidden clock/pill,
  intro image fit, board red-up/green-down text, and right video fill.
- Renderer `slackActive` state, stage rendering, market board cache/update,
  multi-clip video playback using `ended` rotation and `loop` only for one clip.
- Ticker hide path for `tentActive || slackActive`.
- Left pointer `pointerup` branch: if not dragged and `slackActive`, call
  `window.petApi.slackExit()` instead of normal interaction.

## Verification

```text
node scripts/test-duo-renderer-contract.js
test-duo-renderer-contract: ok

node scripts/test-renderer-interaction.js
renderer interaction regression checks passed
```

## Files Changed

- `src/index-v3.html`
- `src/styles-v3.css`
- `src/renderer-v3.js`
- `scripts/test-duo-renderer-contract.js`
- `scripts/test-renderer-interaction.js`
- `.superpowers/sdd/task-4-report.md`

`src/preload-v3.js` already exposed `petApi.slackExit()` and needed no change.

## Concerns

- Live visual verification is deferred because Task 5 owns the real PNG/video
  assets.
- `jump`/`carry` animation display falls back through the existing generic
  `setState`/`resolveAction` path if a petpack does not provide those actions.

## Fix Pass: Slack Overlay Must Not Override Pet State

### Bug

`applySlackStage` called `setState('jump')` and `setState('carry')`. Real
petpacks use action names such as `slack-jump` / `slack-carry`, already driven
by main through `pet:state`, so renderer-side `setState('jump'/'carry')` could
resolve to `idle` and flash the wrong pose.

### RED

Added a regression assertion to `scripts/test-renderer-interaction.js`: while a
`reaction` frame is currently playing, applying slack `jump` or `carry` overlay
must not change `petImage.src`.

```text
node scripts/test-renderer-interaction.js
AssertionError [ERR_ASSERTION]: slack jump overlay must not replace the pet:state animation
+ actual - expected

+ 'idle.png'
- 'reaction.png'
```

### Fix

Removed the `setState('jump', ...)` and `setState('carry', ...)` calls from
`applySlackStage`. Slack overlay now only toggles intro images, board/video
visibility, media playback, and `pet-image` opacity. The active animation stays
owned by `pet:state`.

### Verification

```text
node scripts/test-renderer-interaction.js
renderer interaction regression checks passed

node scripts/test-duo-renderer-contract.js
test-duo-renderer-contract: ok
```
