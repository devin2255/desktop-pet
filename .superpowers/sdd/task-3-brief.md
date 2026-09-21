### Task 3: 主进程菜单、三停、点击收工、窗尺寸

**Files:**
- Modify: `src/main-v3.js`, `src/preload-v3.js`
- Test: `scripts/test-capability-gates.js`（main 源码契约）

**Interfaces:**
- Consumes: `hasDuoSlack`、`beginSlack`/`leaveSlack`、`slackWindowSize`/`placeSlackWindow`
- Produces: 菜单 `duo-slack` / `duo-unslack`；IPC `pet:slack-exit`；overlay `phase:'slack'`

- [ ] **Step 1: 契约测试失败**

在 `testRuntimeCapabilitiesAreManifestGated` 追加：

```js
assert.match(src, /hasDuoSlack\(activeManifest\)/, 'slack is gated by duo.slack');
assert.match(src, /id === 'duo-slack'/);
assert.match(src, /pet:slack-exit/);
assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*mode\(\) === 'slack'/);
assert.match(src, /slackEnabled:\s*hasDuoSlack/);
assert.match(src, /presentationWindowSize\(currentSize\(\), duo\.mode\(\)/);
assert.match(src, /slackExtraHeight:/);
```

`preload-v3.js`：`test-duo-renderer-contract.js` 增加 `assert.match(preload, /slackExit/)` 与 `pet:slack-exit`。

- [ ] **Step 2:** 跑测试失败。

- [ ] **Step 3: 实现要点（对照现有 tent）**

`makeDuoController`：`slackEnabled: hasDuoSlack(activeManifest)`。

`windowSize` 已走 `presentationWindowSize`；传入 `slackExtraHeight: TENT_EXTRA_HEIGHT`（56）。

`runContextMenuAction`：`duo-slack` → `slackViaMenu()`；`duo-unslack` → `leaveSlackViaMenu()`。

`slackViaMenu`：

1. `duo.mode()==='folded'` 且 `hasDuoSlack`，否则 return
2. `pauseBehavior()`；`beginSlack()`
3. `applySlackPresentation('intro')`：`placeSlackWindow(petWindow.getBounds(), windowSize(), workArea)` 后 `setBounds`；`sendDuoOverlay(petWindow, true, { progress: 1, phase: 'slack', slackStage: 'intro', introLeft, introRight, clips, board })`
4. `introLeft/Right`：`petAssetUrl(id, member.animations.idle.frames[0])`
5. 不 `scheduleBehavior`
6. 用 timeout 串阶段：intro 持续 ~700ms → overlay `slackStage:'jump'` + `sendState(jumpAction)` → jump 时长（`duoActionDuration`，夹 500–1800ms）→ overlay `slackStage:'carry'` + `sendState(carryAction)`（缺 carry 则 idle）
7. `pushMarketStatus()`；`restartOfficeBus()`（bus 在 slack 为 false）

`leaveSlackViaMenu` / `onTrustedWin('pet:slack-exit')`：

- 仅 `mode==='slack'`
- 清阶段 timer；`leaveSlack()`；关 overlay；`restorePetWindowSize()`；`sendState('idle')`；`scheduleBehavior(1200)`；恢复雷达

`canRunOfficeBus` / `dispatchWatchState`：`tent` **或** `slack` 直接静音。`canWatchMarket`：**不要**因 slack 关掉轮询（左屏要数）。`pushMarketStatus` 在 slack 时把同一 payload 再塞进 overlay `board`（可在 `applySlackPresentation` 读最后一次 market 缓存，或 renderer 同时听 `pet:market`）。

更简单：renderer 在 `phase==='slack' && slackStage==='carry'` 时用已有 `pet:market` 画左屏，主进程不必复制 board 进 overlay。计划采用这条，减少通道。Overlay 仍传 clips 与 intro URL。

`isSuspended`：含 `slack`。

`scheduleBehavior` / `runBehavior`：`slack` return。

`pet:context-menu`：`slack` 短菜单仅「收工了」、藏起来、退出；无雷达、无展开、无支起来。

`pet:duo-pointer-move`：不处理 `slack`（不 beginUnfold）。

折叠菜单构建：`hasDuoSlack` 时插入 `{ id:'duo-slack', label: slack.enterLabel || '摸会儿鱼' }`。

- [ ] **Step 4:** 契约测试通过。`node --check src/main-v3.js src/preload-v3.js`。跳过 commit。

---
