# Task 1 Report: duo-controller slack 状态机与窗尺寸

## What Was Implemented

在 `src/duo-controller.js` 中新增 slack 状态与窗尺寸辅助函数，遵循现有 tent 模式（`beginTent` / `leaveTent`、`presentationWindowSize`）的模式：

### 新增导出函数

- **`slackWindowSize(size, extraHeight = 56)`** — 基于 folded 尺寸计算 slack 窗口：`height = max(108, foldedH) + extra`；`width = max(foldedW * 2, round(height * 4 / 3))`；保留 `label`。
- **`placeSlackWindow(origin, slackSize, workArea)`** — 以 origin 水平居中、脚底基线对齐放置 slack 窗口，经 `clampToWorkArea` 约束。

### `presentationWindowSize` 扩展

在 tent 分支之后、open 分支之前增加：

```js
if (mode === 'slack') {
  return slackWindowSize(size, options.slackExtraHeight);
}
```

### `createDuoController` 扩展

- 新增选项 `slackEnabled`（默认 `false`）。
- **`beginSlack()`** — 仅当 `slackEnabled && mode === 'folded'` 时进入 `slack` 模式。
- **`leaveSlack()`** — 仅当 `mode === 'slack'` 时返回 `folded`。
- **`beginUnfold()`** — 增加 `mode === 'slack'` 时返回 `false`（阻止手势展开）。
- **`beginTent()`** — 保持 folded-only 检查，slack 模式下自然无法进入 tent（无需额外分支）。

## What Was Tested and Results

| Command | Result |
|---|---|
| `node scripts/test-duo-controller.js`（RED） | exit 1 — `TypeError: slackOff.beginSlack is not a function` |
| `node scripts/test-duo-controller.js`（GREEN） | `test-duo-controller: ok`（exit 0） |
| `node --check src/duo-controller.js` | exit 0，无输出 |

新增测试覆盖：

- `slackEnabled: false` 时 `beginSlack()` 返回 false
- slack ↔ folded 状态切换
- slack 阻止 `beginUnfold` / `beginTent`；tent 阻止 `beginSlack`
- `slackEnabled: true` 时 folded 可正常 `beginUnfold`
- `slackWindowSize(petSize, 56)` 高度 246、宽度 ≥ 340
- `presentationWindowSize(..., 'slack', { slackExtraHeight: 56 })` 与 `slackWindowSize` 一致
- `placeSlackWindow` 脚底基线保持不变

## TDD Evidence

### RED

```
node scripts/test-duo-controller.js
```

```
D:\Vibe_Coding\desktop-pet\scripts\test-duo-controller.js:174
assert.strictEqual(slackOff.beginSlack(), false);
                            ^

TypeError: slackOff.beginSlack is not a function
    at Object.<anonymous> (D:\Vibe_Coding\desktop-pet\scripts\test-duo-controller.js:174:29)
```

### GREEN

```
node scripts/test-duo-controller.js
```

```
test-duo-controller: ok
```

```
node --check src/duo-controller.js
```

(exit 0, no output)

## Files Changed

| File | Action |
|---|---|
| `src/duo-controller.js` | 新增 `slackWindowSize`、`placeSlackWindow`；扩展 `createDuoController` 与 `presentationWindowSize` |
| `scripts/test-duo-controller.js` | 追加 brief 指定 slack 测试块；require 增加 `slackWindowSize`、`placeSlackWindow` |

## Self-Review Findings

- 实现与 brief 指定代码 verbatim 一致，未扩展 scope。
- `beginTent` 保持 folded-only，slack 模式下 `mode !== 'folded'` 已自然阻止进入 tent。
- slack 与 tent 互斥：tent 时 `beginSlack` 失败（mode 非 folded）；slack 时 `beginTent` 失败（同上）。
- 未修改 renderer、main、菜单或资源，符合 Task 1 边界。
- 未 git commit（用户要求）。

## Issues or Concerns

无阻塞项。后续任务需接线菜单入口、renderer 与 slack 素材。
