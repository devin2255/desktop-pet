# Task 2 Report: 把 niulai 通用模块与测试拷进 son-mode

**Branch:** `feature/son-mode`  
**Status:** DONE  
**Date:** 2026-08-31

## Summary

已将 niulai 的通用 IM 总线、飞书/钉钉适配器、钉钉 UIA 挂断、行情监测、趋近目标、任务 mock、序列/渲染器/清单校验增强及其测试带入 son-mode。

## Son-mode 接线

- `src/main-v3.js` 使用 `capability-gates` 控制雷达、挂断与行情托盘项的可见性；无宠物 ID 特判。
- 保留 son-mode 的飞书 `notifyQwenWork` 与任务文件轮询作为默认任务路径。
- 当 `boss-watch.json` 设置 `tasks.provider: "mock"` 时，任务改由 `schedulePetTaskMock` 返回结果。
- 默认 watch 配置使用 `tasks: { provider: "feishu" }`，且 `callHangup.enabled`、`dingtalk.enabled`、`market.enabled` 都为 `false`。
- 兄弟判官清单添加 `watch.menuLabel: "画饼雷达"`。
- 客户构建和常规 Electron 构建都包含新增通用模块与 `src/capability-gates.js`。

## 测试

首次 `node scripts/test-im-bus.js` 因构建白名单未更新而失败；更新 `package.json` 后通过。

首次 `npm run test:js` 暴露两个本次引入接口/默认值的断裂：

1. 渲染器测试的 `petApi` mock 缺少 `onMarket`。
2. niulai 测试期待启用钉钉挂断/钉钉适配器，与 son-mode 要求的禁用默认值冲突。

已只修复上述本次接线项，并增加 `tasks.provider: "mock"` 的配置加载回归测试。

通过的命令：

```powershell
node scripts/test-capability-gates.js
node scripts/test-pet-task.js
node scripts/test-approach-target.js
node scripts/test-im-bus.js
node scripts/test-interaction-controller.js
node scripts/test-sequence-controller.js
npm run test:js
```

所有命令通过。

## 自审

- `git diff HEAD --check` 通过。
- 未检出或添加 `pets/library/niulai`、`pets/packages/niulai.petpack`、niulai 制作脚本或审计脚本。
- `src/main-v3.js` 未发现 `niulai` 或 `brother-judge` 的 ID 条件分支。

## Commit

`feat: merge generic IM, hangup, market, and sequence approach into son-mode`

## Concerns

无阻塞问题。未构建 EXE 或实际触发外部飞书、钉钉与行情服务；本任务要求的单元及 JS 集成测试均已通过。

## Review fixes (2026-08-31)

### Changed

- 常规 Electron 构建白名单加入 `src/market-watch.js`；`test:js` 加入其语法检查及 `node scripts/test-market-watch.js`。
- 将 IM 总线、钉钉挂断轮询、行情监测分别收敛为 `canRunOfficeBus`、`canPollCallHangup`、`canWatchMarket`：均同时检查配置和活动 petpack capability。切换宠物时重新加载该宠物的 watch 配置，并停止/按新门禁重启 IM 与行情能力。
- `pushMarketStatus()` 只在 `market.enabled && hasMarketSequences(activeManifest)` 时显示行情条；钉钉适配器收到的 `callHangup.enabled` 也使用相同的资源包门禁。
- mock 任务在写入任何 pending 文件或启动 file-based `eventHold` 之前返回；模拟结果以普通 speech hold 汇报，因此不会遗留轮询永不完成的任务文件。
- 扩展 capability/task 回归测试，覆盖上述运行时门禁、宠物切换重启、市场构建/测试接入及 mock 任务无文件 hold。

### Commands and full test output summary

```powershell
node scripts/test-capability-gates.js
# PASS: test-capability-gates: ok

node scripts/test-pet-task.js
# PASS: test-pet-task: ok

node scripts/test-market-watch.js
# PASS: test-market-watch: all 7 scenarios passed

npm run test:js
# PASS: all 20 node --check targets and all JS scripts completed successfully.
# PASS: capability-gates, pet-task, market-watch, renderer interaction,
# petpack security, sequence schema/controller, window interaction/discovery,
# interaction/topmost/mouse-through/runtime CDP, laopo petpack, startup greeting,
# approach-target, watch-rules/config, IM match/bus/DingTalk/UIA,
# edge voice, message watcher, event hold, and roam motion.
```

## Important review fixes (2026-08-31)

- Commit: `e015810` (`fix: clean up cancelled sequence helpers`)

```powershell
node scripts/test-watch-config.js
# PASS: 20 config scenarios; DingTalk is disabled unless explicitly enabled.
node scripts/test-sequence-controller.js
# PASS: cancellation runs registered sequence cleanup callbacks.
npm run test:js
# PASS: all syntax checks and JS regression suites completed successfully.
```
