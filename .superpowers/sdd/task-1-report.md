# Task 1 Report: 序列引擎（纯逻辑 + 测试）

## 实现摘要

实现了纯逻辑序列控制器 `createSequenceController`，供后续 Electron main 集成闺蜜宠物（小美&小甜）的多阶段动画序列。模块通过依赖注入接收 `getManifest`、`sendState`、`pauseBehavior`、`scheduleBehavior` 及可选定时器钩子（`now`、`setTimer`、`clearTimer`），无 UI、无 petpack 改动。

### 导出 API

| 方法 | 行为 |
|------|------|
| `start(id)` | 校验序列存在且 stages 非空、各 action 在 animations 中；若已在播放则先 cancel（不 schedule）；调用 `pauseBehavior`；从 stage 0 播放；返回 boolean |
| `cancel()` | 清 timer、`sendState('idle')`、`scheduleBehavior(900)` |
| `dispose()` | 同 cancel 但不 schedule |
| `continueFromClick()` | 仅在 `waitForClick` 等待中 advance；返回 boolean |
| `isWaitingForClick()` | 当前 stage 是否等待点击 |
| `isActive()` | 序列是否进行中 |

### 阶段播放逻辑

- 非 `waitForClick`：按 `duration`（缺省 3000ms）设 timer 后 advance；`idle` + `duration: 0` 立即 advance
- `waitForClick`：播状态后进入等待，不设完成 timer；由 `continueFromClick` 推进
- `sendState(action, message, '', extras)`：`messages` / `messageGapMs` 通过 extras 传递；有 `messages` 时 `message` 取 `stage.message` 或首句

## 变更文件

| 文件 | 操作 |
|------|------|
| `src/sequence-controller.js` | 新建 — 序列控制器实现 |
| `scripts/test-sequence-controller.js` | 新建 — TDD 测试（与 brief  verbatim） |
| `package.json` | 修改 — `test:js` 加入 `node --check src/sequence-controller.js` 与 `node scripts/test-sequence-controller.js` |

## TDD 证据

### RED — 模块不存在

```
$ node scripts/test-sequence-controller.js
Error: Cannot find module '../src/sequence-controller'
Require stack:
- D:\Vibe_Coding\desktop-pet\scripts\test-sequence-controller.js
  code: 'MODULE_NOT_FOUND'
```

### GREEN — 实现后单测通过

```
$ node scripts/test-sequence-controller.js
test-sequence-controller: ok
```

### 全量 JS 测试

```
$ npm run test:js
renderer interaction regression checks passed
petpack archive security checks passed
window interaction geometry checks passed
window discovery checks passed
interaction controller checks passed
topmost guard checks passed
runtime CDP contract tests passed
laopo petpack regression checks passed
startup greeting checks passed
test-sequence-controller: ok
```

退出码：0。未引入新的既有测试失败。

## 自检

### 符合 brief 要点

- [x] TDD：先写失败测试，再实现，再全绿
- [x] 导出 `createSequenceController`，CommonJS `module.exports`
- [x] 注入 timer 钩子，缺省回退真实 `setTimeout`/`clearTimeout`
- [x] `start` 校验 stages 与 animations
- [x] `waitForClick` / `continueFromClick` 分支
- [x] `cancel` / `dispose` 差异（schedule 与否）
- [x] 重复 `start` 先 cancel（`schedule: false`）
- [x] `package.json` `test:js` 已更新
- [x] 未创建 git commit（按 Global Constraints）

### 代码质量

- 与 `interaction-controller.js` 一致：`'use strict'`、依赖注入、可选 deps 回退
- 无多余抽象；状态变量最小集（active、stageIndex、stages、waitingForClick、timerId）
- 语法检查：`node --check src/sequence-controller.js` 通过（含于 `npm run test:js`）

### 未覆盖（留待后续 task）

- 无效 sequence id / 空 stages / 未知 action 的单元断言（brief 测试未要求）
- `dispose` 独立测试
- 与 main-v3 的实际接线

## Concerns

1. **测试覆盖面较窄**：当前仅一条 happy-path + cancel；边界错误路径无断言，后续集成前可考虑补充。
2. **`cancel({ schedule: false })` 为内部选项**：未暴露在公开 API，重复 `start` 时由内部使用；若外部需要「静默取消」需再暴露或文档化。
3. **无 concern 阻塞合并**：单测与全量 `test:js` 均通过，可进入 Task 2 接线。

## Commits

无（按 plan Global Constraints 与用户规则，未执行 commit）。
